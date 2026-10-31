package worker

import (
	"fmt"
	"sync"
)

// FSM manages the validated state transitions of a meeting
type FSM struct {
	mu           sync.RWMutex
	currentState State
}

// NewFSM initializes a new state machine in SCHEDULED state
func NewFSM(initial State) *FSM {
	if initial == "" {
		initial = StateScheduled
	}
	return &FSM{
		currentState: initial,
	}
}

// Current returns the current state thread-safely
func (f *FSM) Current() State {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.currentState
}

// IsTerminal returns true if the current state is an end state
func (f *FSM) IsTerminal() bool {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.currentState == StateCallEnded ||
		f.currentState == StateAdmissionDenied ||
		f.currentState == StateFailed
}

// Transition attempts to transition to the target state
func (f *FSM) Transition(target State) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.currentState == target {
		return nil
	}

	if !isValidTransition(f.currentState, target) {
		return fmt.Errorf("invalid transition from %s to %s", f.currentState, target)
	}

	f.currentState = target
	return nil
}

func isValidTransition(from, to State) bool {
	// Terminal state cannot transition to non-terminal
	if from == StateCallEnded || from == StateAdmissionDenied {
		return false
	}

	// Always allow transition to FAILED from any non-terminal state
	if to == StateFailed {
		return true
	}

	switch from {
	case StateScheduled:
		return to == StateInitializing

	case StateInitializing:
		return to == StateNavigating

	case StateNavigating:
		return to == StatePreJoin

	case StatePreJoin:
		return to == StateWaitingForAdmission || to == StateInMeeting

	case StateWaitingForAdmission:
		return to == StateInMeeting || to == StateAdmissionDenied

	case StateInMeeting:
		return to == StateLeaving || to == StateCallEnded

	case StateLeaving:
		return to == StateCallEnded

	default:
		return false
	}
}

