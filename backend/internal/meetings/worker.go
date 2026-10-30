/*
Package meetings provides the client interface and implementations for
coordinating with the meeting worker service.

Purpose:
  - Establishes the worker contract for bot dispatch and lifecycle commands.
  - Connects to Gagan's Playwright-based meeting worker without intruding on its internal implementation.
  - Provides a MockWorkerClient for deterministic, hermetic tests and offline development.

Key Types and Functions:
  - WorkerClient (Interface)
  - WorkerJoinRequest, WorkerJoinResponse
  - HTTPWorkerClient (Struct)
  - MockWorkerClient (Struct)
  - NewHTTPWorkerClient(baseURL string, timeout time.Duration) *HTTPWorkerClient
  - NewMockWorkerClient() *MockWorkerClient
*/
package meetings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

var (
	ErrWorkerUnavailable = errors.New("meeting worker service unavailable")
	ErrWorkerJoinFailed  = errors.New("meeting worker failed to join meeting")
	ErrWorkerStopFailed  = errors.New("meeting worker failed to stop meeting")
)

// WorkerJoinRequest represents the payload sent to the worker to dispatch a bot.
type WorkerJoinRequest struct {
	MeetingID  string `json:"meeting_id"`
	MeetingURL string `json:"meeting_url"`
	BotName    string `json:"bot_name"`
}

// WorkerJoinResponse represents the response returned by the worker upon dispatch.
type WorkerJoinResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// WorkerClient abstracts communication with the meeting bot worker.
type WorkerClient interface {
	JoinMeeting(ctx context.Context, req *WorkerJoinRequest) (*WorkerJoinResponse, error)
	StopMeeting(ctx context.Context, meetingID string) error
}

// HTTPWorkerClient communicates with Gagan's Playwright meeting worker over HTTP.
type HTTPWorkerClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPWorkerClient constructs an HTTPWorkerClient pointing to the worker service URL.
func NewHTTPWorkerClient(baseURL string, timeout time.Duration) *HTTPWorkerClient {
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	return &HTTPWorkerClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// JoinMeeting triggers the worker to launch a browser and join the Google Meet session.
func (c *HTTPWorkerClient) JoinMeeting(ctx context.Context, req *WorkerJoinRequest) (*WorkerJoinResponse, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("%w: worker URL is not configured", ErrWorkerUnavailable)
	}

	payload, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal worker join request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/join", c.baseURL), bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to build worker request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrWorkerUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return nil, fmt.Errorf("%w (status: %d)", ErrWorkerJoinFailed, resp.StatusCode)
	}

	var joinResp WorkerJoinResponse
	if err := json.NewDecoder(resp.Body).Decode(&joinResp); err != nil {
		return nil, fmt.Errorf("failed to decode worker join response: %w", err)
	}

	return &joinResp, nil
}

// StopMeeting signals the worker to leave the meeting and perform cleanup.
func (c *HTTPWorkerClient) StopMeeting(ctx context.Context, meetingID string) error {
	if c.baseURL == "" {
		return fmt.Errorf("%w: worker URL is not configured", ErrWorkerUnavailable)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/meetings/%s/stop", c.baseURL, meetingID), nil)
	if err != nil {
		return fmt.Errorf("failed to build worker stop request: %w", err)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrWorkerUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("%w (status: %d)", ErrWorkerStopFailed, resp.StatusCode)
	}

	return nil
}

// MockWorkerClient provides a controllable mock implementation for tests.
type MockWorkerClient struct {
	mu            sync.Mutex
	ActiveMeetings map[string]bool
	ShouldFailJoin bool
	ShouldFailStop bool
	JoinCallCount  int
	StopCallCount  int
}

// NewMockWorkerClient creates a new MockWorkerClient.
func NewMockWorkerClient() *MockWorkerClient {
	return &MockWorkerClient{
		ActiveMeetings: make(map[string]bool),
	}
}

// JoinMeeting records active meeting in mock store.
func (m *MockWorkerClient) JoinMeeting(_ context.Context, req *WorkerJoinRequest) (*WorkerJoinResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.JoinCallCount++
	if m.ShouldFailJoin {
		return nil, ErrWorkerJoinFailed
	}

	m.ActiveMeetings[req.MeetingID] = true
	return &WorkerJoinResponse{
		Status:  "dispatched",
		Message: "Worker successfully dispatched to Google Meet",
	}, nil
}

// StopMeeting marks meeting as stopped in mock store.
func (m *MockWorkerClient) StopMeeting(_ context.Context, meetingID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.StopCallCount++
	if m.ShouldFailStop {
		return ErrWorkerStopFailed
	}

	delete(m.ActiveMeetings, meetingID)
	return nil
}
