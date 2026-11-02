/*
Package meetings implements the business logic, status transitions,
and orchestration for meeting creation, joining, stopping, and transcript retrieval.

Purpose:
  - Validates meeting URLs across platforms (Google Meet, Zoom, Teams, Generic).
  - Controls meeting state transitions (scheduled -> waiting_for_admission -> joined/recording -> completed/failed).
  - Enforces the "no fake success" rule by returning explicit errors on validation, state, or worker failures.
  - Exposes in-memory publish/subscribe for real-time SSE streaming to clients.

Key Types and Functions:
  - Service (Struct)
  - LiveEvent (Struct)
  - NewService(repo Repository, worker WorkerClient, defaultBotName string) *Service
  - CreateAndStartMeeting(ctx, req) (*Meeting, error)
  - ListMeetings(ctx) ([]*Meeting, error)
  - GetMeeting(ctx, id) (*Meeting, error)
  - StopMeeting(ctx, id) (*Meeting, error)
  - GetTranscript(ctx, id) ([]*TranscriptSegment, error)
  - AddTranscriptSegment(ctx, id, req) (*TranscriptSegment, error)
  - ProcessMeetingAudio(ctx, meetingID, audioPath) (*Meeting, error)
  - Subscribe(id) chan LiveEvent
  - Unsubscribe(id, ch)
  - Broadcast(id, event)
*/
package meetings

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"spectrum-ai/backend/internal/transcription"

	"github.com/google/uuid"
)

var (
	ErrInvalidStateTransition = errors.New("invalid state transition")
	ErrMeetingAlreadyStopped  = errors.New("meeting is already stopped or in a terminal state")
)

// LiveEvent represents an incremental event published to real-time subscribers.
type LiveEvent struct {
	Type      string      `json:"type"`
	MeetingID string      `json:"meeting_id"`
	Payload   interface{} `json:"payload"`
}

// Service encapsulates meeting business logic.
type Service struct {
	repo             Repository
	worker           WorkerClient
	transcriber      transcription.Client
	defaultBotName   string
	startedCallbacks []func(m *Meeting)
	subscribers      map[string][]chan LiveEvent
	subMu            sync.RWMutex
}

// NewService constructs a new meeting Service.
func NewService(repo Repository, worker WorkerClient, defaultBotName string) *Service {
	if strings.TrimSpace(defaultBotName) == "" {
		defaultBotName = "Spectra Bot"
	}
	return &Service{
		repo:             repo,
		worker:           worker,
		transcriber:      transcription.NewMockClient(),
		defaultBotName:   defaultBotName,
		startedCallbacks: make([]func(m *Meeting), 0),
		subscribers:      make(map[string][]chan LiveEvent),
	}
}

// SetTranscriber injects the transcription client.
func (s *Service) SetTranscriber(t transcription.Client) {
	if t != nil {
		s.transcriber = t
	}
}

// OnMeetingStarted registers a callback invoked when a meeting successfully starts.
func (s *Service) OnMeetingStarted(cb func(m *Meeting)) {
	if cb != nil {
		s.startedCallbacks = append(s.startedCallbacks, cb)
	}
}

// Subscribe returns a channel receiving real-time events for the specified meeting.
func (s *Service) Subscribe(meetingID string) chan LiveEvent {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	ch := make(chan LiveEvent, 32)
	s.subscribers[meetingID] = append(s.subscribers[meetingID], ch)
	return ch
}

// Unsubscribe removes an event channel from the meeting subscriber list.
func (s *Service) Unsubscribe(meetingID string, ch chan LiveEvent) {
	s.subMu.Lock()
	defer s.subMu.Unlock()

	subs := s.subscribers[meetingID]
	for i, sub := range subs {
		if sub == ch {
			s.subscribers[meetingID] = append(subs[:i], subs[i+1:]...)
			close(ch)
			break
		}
	}
	if len(s.subscribers[meetingID]) == 0 {
		delete(s.subscribers, meetingID)
	}
}

// Broadcast dispatches a live event to all active subscribers for the meeting.
func (s *Service) Broadcast(meetingID string, event LiveEvent) {
	s.subMu.RLock()
	defer s.subMu.RUnlock()

	for _, ch := range s.subscribers[meetingID] {
		select {
		case ch <- event:
		default:
		}
	}
}

// CreateAndStartMeeting validates the meeting URL, creates the meeting record,
// dispatches the worker bot, and advances the meeting status.
func (s *Service) CreateAndStartMeeting(ctx context.Context, req *CreateMeetingRequest) (*Meeting, error) {
	if req == nil {
		return nil, errors.New("request payload cannot be empty")
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("meeting title is required")
	}

	// 1. General meeting URL validation across platforms
	platform, canonicalURL, code, err := ValidateMeetingURL(req.MeetingURL)
	if err != nil {
		return nil, err
	}
	if req.Platform != "" {
		platform = req.Platform
	}

	botName := strings.TrimSpace(req.BotName)
	if botName == "" {
		botName = s.defaultBotName
	}

	now := time.Now().UTC()
	meeting := &Meeting{
		ID:              uuid.New().String(),
		Title:           title,
		Platform:        platform,
		MeetingURL:      canonicalURL,
		MeetingCode:     code,
		Status:          StatusWaitingForAdmission,
		BotName:         botName,
		CalendarEventID: strings.TrimSpace(req.CalendarEventID),
		ScheduledAt:     req.ScheduledAt,
		StartedAt:       &now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	// 2. Persist record in repository
	if err := s.repo.Create(ctx, meeting); err != nil {
		return nil, fmt.Errorf("failed to create meeting: %w", err)
	}

	// 3. Coordinate with meeting worker (Playwright bot)
	joinReq := &WorkerJoinRequest{
		MeetingID:  meeting.ID,
		MeetingURL: meeting.MeetingURL,
		BotName:    meeting.BotName,
	}

	_, err = s.worker.JoinMeeting(ctx, joinReq)
	if err != nil {
		// Enforce "no fake success": mark status as failed and record failure reason
		meeting.Status = StatusFailed
		meeting.FailureReason = fmt.Sprintf("worker dispatch failed: %v", err)
		meeting.UpdatedAt = time.Now().UTC()
		_ = s.repo.Update(ctx, meeting)
		return nil, fmt.Errorf("failed to dispatch meeting bot: %w", err)
	}

	// Worker accepted dispatch -> transition to recording/joined
	meeting.Status = StatusRecording
	meeting.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, meeting); err != nil {
		return nil, fmt.Errorf("failed to update meeting status: %w", err)
	}

	for _, cb := range s.startedCallbacks {
		cb(meeting)
	}

	s.Broadcast(meeting.ID, LiveEvent{
		Type:      "STATE_CHANGE",
		MeetingID: meeting.ID,
		Payload:   meeting.ToResponse(),
	})

	return meeting, nil
}

// ListMeetings returns all meeting records.
func (s *Service) ListMeetings(ctx context.Context) ([]*Meeting, error) {
	return s.repo.List(ctx)
}

// GetMeeting retrieves a meeting by its unique ID.
func (s *Service) GetMeeting(ctx context.Context, id string) (*Meeting, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("meeting id is required")
	}
	return s.repo.GetByID(ctx, id)
}

// StopMeeting halts an ongoing meeting session, orders the worker to exit,
// and marks the meeting completed.
func (s *Service) StopMeeting(ctx context.Context, id string) (*Meeting, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("meeting id is required")
	}

	meeting, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// State machine check: cannot stop a meeting that has already terminated
	if meeting.Status.IsTerminal() {
		return nil, fmt.Errorf("%w: meeting %s has status '%s'", ErrMeetingAlreadyStopped, id, meeting.Status)
	}

	// Signal the worker to leave the meeting (warn on error, do not fail user stop request)
	if err := s.worker.StopMeeting(ctx, id); err != nil {
		log.Printf("[MeetingService] Worker stop warning for %s: %v", id, err)
	}

	now := time.Now().UTC()
	meeting.Status = StatusCompleted
	meeting.EndedAt = &now
	meeting.UpdatedAt = now

	if err := s.repo.Update(ctx, meeting); err != nil {
		return nil, fmt.Errorf("failed to update meeting: %w", err)
	}

	s.Broadcast(meeting.ID, LiveEvent{
		Type:      "STATE_CHANGE",
		MeetingID: meeting.ID,
		Payload:   meeting.ToResponse(),
	})

	return meeting, nil
}

// AddTranscriptSegment saves a single transcribed segment directly to repository and broadcasts it live.
func (s *Service) AddTranscriptSegment(ctx context.Context, meetingID string, req *CreateSegmentRequest) (*TranscriptSegment, error) {
	id := strings.TrimSpace(meetingID)
	if id == "" {
		return nil, errors.New("meeting id is required")
	}
	if req == nil || strings.TrimSpace(req.Text) == "" {
		return nil, errors.New("segment text is required")
	}

	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return nil, fmt.Errorf("meeting not found: %w", err)
	}

	speaker := strings.TrimSpace(req.Speaker)
	if speaker == "" {
		speaker = "Speaker 1"
	}

	segment := &TranscriptSegment{
		ID:          uuid.New().String(),
		MeetingID:   id,
		Speaker:     speaker,
		Text:        strings.TrimSpace(req.Text),
		StartTimeMs: req.StartTimeMs,
		EndTimeMs:   req.EndTimeMs,
		CreatedAt:   time.Now().UTC(),
	}

	if err := s.repo.AddTranscriptSegment(ctx, segment); err != nil {
		return nil, fmt.Errorf("failed to add transcript segment: %w", err)
	}

	s.Broadcast(id, LiveEvent{
		Type:      "TRANSCRIPT_SEGMENT",
		MeetingID: id,
		Payload:   segment,
	})

	return segment, nil
}

// ProcessMeetingAudio sends recorded meeting audio to the AI transcription service,
// persists all returned transcript segments, and finalizes meeting status.
func (s *Service) ProcessMeetingAudio(ctx context.Context, meetingID string, audioPath string) (*Meeting, error) {
	id := strings.TrimSpace(meetingID)
	if id == "" {
		return nil, errors.New("meeting id is required")
	}

	meeting, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("meeting not found: %w", err)
	}

	// 1. Transition to processing
	meeting.Status = StatusProcessing
	meeting.AudioPath = audioPath
	meeting.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(ctx, meeting); err != nil {
		return nil, fmt.Errorf("failed to update status to processing: %w", err)
	}

	s.Broadcast(id, LiveEvent{
		Type:      "STATE_CHANGE",
		MeetingID: id,
		Payload:   meeting.ToResponse(),
	})

	// 2. Call AI transcription service
	result, err := s.transcriber.TranscribeFile(ctx, id, audioPath)
	if err != nil {
		meeting.Status = StatusFailed
		meeting.FailureReason = fmt.Sprintf("transcription error: %v", err)
		meeting.ErrorMessage = meeting.FailureReason
		meeting.UpdatedAt = time.Now().UTC()
		_ = s.repo.Update(ctx, meeting)
		return nil, fmt.Errorf("transcription processing failed: %w", err)
	}

	// 3. Persist segments in repository
	for _, seg := range result.Segments {
		segmentModel := &TranscriptSegment{
			ID:          uuid.New().String(),
			MeetingID:   id,
			Speaker:     seg.Speaker,
			Text:        seg.Text,
			StartTimeMs: seg.StartTimeMs,
			EndTimeMs:   seg.EndTimeMs,
			CreatedAt:   time.Now().UTC(),
		}
		_ = s.repo.AddTranscriptSegment(ctx, segmentModel)
		s.Broadcast(id, LiveEvent{
			Type:      "TRANSCRIPT_SEGMENT",
			MeetingID: id,
			Payload:   segmentModel,
		})
	}

	// 4. Mark completed
	now := time.Now().UTC()
	meeting.Status = StatusCompleted
	if meeting.EndedAt == nil {
		meeting.EndedAt = &now
	}
	meeting.UpdatedAt = now
	if err := s.repo.Update(ctx, meeting); err != nil {
		return nil, fmt.Errorf("failed to update meeting to completed: %w", err)
	}

	s.Broadcast(id, LiveEvent{
		Type:      "STATE_CHANGE",
		MeetingID: id,
		Payload:   meeting.ToResponse(),
	})

	return meeting, nil
}

// GetTranscript retrieves all transcribed segments for a meeting.
func (s *Service) GetTranscript(ctx context.Context, id string) ([]*TranscriptSegment, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, errors.New("meeting id is required")
	}

	// Ensure meeting exists
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return nil, err
	}

	return s.repo.GetTranscript(ctx, id)
}
