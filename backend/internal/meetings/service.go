/*
Package meetings implements the business logic, status transitions,
and orchestration for meeting creation, joining, stopping, and transcript retrieval.

Purpose:
  - Validates Google Meet URLs and meeting codes.
  - Controls meeting state transitions (scheduled -> waiting_for_admission -> joined/recording -> completed/failed).
  - Enforces the "no fake success" rule by returning explicit errors on validation, state, or worker failures.

Key Types and Functions:
  - Service (Struct)
  - NewService(repo Repository, worker WorkerClient, defaultBotName string) *Service
  - CreateAndStartMeeting(ctx, req) (*Meeting, error)
  - ListMeetings(ctx) ([]*Meeting, error)
  - GetMeeting(ctx, id) (*Meeting, error)
  - StopMeeting(ctx, id) (*Meeting, error)
  - GetTranscript(ctx, id) ([]*TranscriptSegment, error)
*/
package meetings

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidStateTransition = errors.New("invalid state transition")
	ErrMeetingAlreadyStopped  = errors.New("meeting is already stopped or in a terminal state")
)

// Service encapsulates meeting business logic.
type Service struct {
	repo           Repository
	worker         WorkerClient
	defaultBotName string
}

// NewService constructs a new meeting Service.
func NewService(repo Repository, worker WorkerClient, defaultBotName string) *Service {
	if strings.TrimSpace(defaultBotName) == "" {
		defaultBotName = "Spectra Bot"
	}
	return &Service{
		repo:           repo,
		worker:         worker,
		defaultBotName: defaultBotName,
	}
}

// CreateAndStartMeeting validates the Google Meet URL, creates the meeting record,
// dispatches the worker bot, and advances the meeting status.
func (s *Service) CreateAndStartMeeting(ctx context.Context, req *CreateMeetingRequest) (*Meeting, error) {
	if req == nil {
		return nil, errors.New("request payload cannot be empty")
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("meeting title is required")
	}

	// 1. Strict Google Meet URL validation
	canonicalURL, code, err := ValidateGoogleMeetURL(req.MeetingURL)
	if err != nil {
		return nil, err
	}

	botName := strings.TrimSpace(req.BotName)
	if botName == "" {
		botName = s.defaultBotName
	}

	now := time.Now().UTC()
	meeting := &Meeting{
		ID:          uuid.New().String(),
		Title:       title,
		MeetingURL:  canonicalURL,
		MeetingCode: code,
		Status:      StatusWaitingForAdmission,
		BotName:     botName,
		StartedAt:   &now,
		CreatedAt:   now,
		UpdatedAt:   now,
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

	// Signal the worker to leave the meeting
	if err := s.worker.StopMeeting(ctx, id); err != nil {
		return nil, fmt.Errorf("failed to stop worker: %w", err)
	}

	now := time.Now().UTC()
	meeting.Status = StatusCompleted
	meeting.EndedAt = &now
	meeting.UpdatedAt = now

	if err := s.repo.Update(ctx, meeting); err != nil {
		return nil, fmt.Errorf("failed to update meeting: %w", err)
	}

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
