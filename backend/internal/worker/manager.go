package worker

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// StateListener is a callback function invoked when a meeting state changes
type StateListener func(meetingID string, state State, message string)

// Manager orchestrates meeting worker lifecycles and maintains state machines
type Manager struct {
	client    *Client
	mu        sync.RWMutex
	instances map[string]*instance
	listeners []StateListener
}

type instance struct {
	fsm        *FSM
	info       *SessionInfo
	cancelFunc context.CancelFunc
}

var (
	defaultManager *Manager
	once           sync.Once
)

// InitManager initializes the global worker manager singleton
func InitManager(workerBaseURL string) *Manager {
	once.Do(func() {
		defaultManager = &Manager{
			client:    NewClient(workerBaseURL),
			instances: make(map[string]*instance),
		}
	})
	return defaultManager
}

// GetManager returns the initialized worker manager
func GetManager() *Manager {
	if defaultManager == nil {
		return InitManager("")
	}
	return defaultManager
}

// OnStateChange registers a callback to be called on any state transition
func (m *Manager) OnStateChange(listener StateListener) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.listeners = append(m.listeners, listener)
}

func (m *Manager) notifyListeners(meetingID string, state State, message string) {
	m.mu.RLock()
	listeners := make([]StateListener, len(m.listeners))
	copy(listeners, m.listeners)
	m.mu.RUnlock()

	for _, l := range listeners {
		go l(meetingID, state, message)
	}
}

// StartMeeting initiates an automated bot join flow for the given meeting
func (m *Manager) StartMeeting(ctx context.Context, meetingID, meetingURL string) error {
	m.mu.Lock()
	if _, exists := m.instances[meetingID]; exists {
		m.mu.Unlock()
		return fmt.Errorf("meeting %s is already active or in progress", meetingID)
	}

	sessionCtx, cancel := context.WithCancel(context.Background())
	fsm := NewFSM(StateScheduled)
	info := &SessionInfo{
		MeetingID:  meetingID,
		MeetingURL: meetingURL,
		State:      StateScheduled,
		StartedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	inst := &instance{
		fsm:        fsm,
		info:       info,
		cancelFunc: cancel,
	}
	m.instances[meetingID] = inst
	m.mu.Unlock()

	// Call worker microservice to start session
	startReq := StartRequest{
		MeetingID:  meetingID,
		MeetingURL: meetingURL,
	}

	if err := m.client.StartSession(ctx, startReq); err != nil {
		m.updateState(meetingID, StateFailed, fmt.Sprintf("Failed to contact worker: %v", err))
		return err
	}

	// Stream events in background goroutine
	go m.monitorEventStream(sessionCtx, meetingID)

	return nil
}

// StopMeeting signals the worker to leave the meeting gracefully
func (m *Manager) StopMeeting(ctx context.Context, meetingID, reason string) error {
	m.mu.RLock()
	inst, exists := m.instances[meetingID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("meeting %s not found in active manager", meetingID)
	}

	_ = inst.fsm.Transition(StateLeaving)
	m.updateState(meetingID, StateLeaving, reason)

	stopReq := StopRequest{
		MeetingID: meetingID,
		Reason:    reason,
	}

	err := m.client.StopSession(ctx, stopReq)
	inst.cancelFunc()

	m.updateState(meetingID, StateCallEnded, "Session stopped")
	return err
}

// GetMeetingState returns the current state of the requested meeting
func (m *Manager) GetMeetingState(meetingID string) (State, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	inst, exists := m.instances[meetingID]
	if !exists {
		return "", fmt.Errorf("meeting %s not found", meetingID)
	}

	return inst.fsm.Current(), nil
}

// ListActiveMeetings returns an overview of all active sessions
func (m *Manager) ListActiveMeetings() []*SessionInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	list := make([]*SessionInfo, 0, len(m.instances))
	for _, inst := range m.instances {
		copyInfo := *inst.info
		list = append(list, &copyInfo)
	}
	return list
}

func (m *Manager) updateState(meetingID string, newState State, message string) {
	m.mu.Lock()
	inst, exists := m.instances[meetingID]
	if !exists {
		m.mu.Unlock()
		return
	}

	_ = inst.fsm.Transition(newState)
	inst.info.State = newState
	inst.info.UpdatedAt = time.Now()
	if newState == StateFailed {
		inst.info.LastError = message
	}

	if inst.fsm.IsTerminal() {
		// Retain in map for history, but cancel context
		inst.cancelFunc()
	}
	m.mu.Unlock()

	log.Printf("[WorkerManager] Meeting %s transitioned to %s (%s)", meetingID, newState, message)
	m.notifyListeners(meetingID, newState, message)
}

func (m *Manager) monitorEventStream(ctx context.Context, meetingID string) {
	err := m.client.StreamEvents(ctx, meetingID, func(event Event) {
		if event.State != "" {
			m.updateState(meetingID, event.State, event.Message)
		}
	})

	if err != nil && ctx.Err() == nil {
		log.Printf("[WorkerManager] Event stream for %s ended with error: %v", meetingID, err)
		m.updateState(meetingID, StateFailed, fmt.Sprintf("Event stream disconnected: %v", err))
	}
}

