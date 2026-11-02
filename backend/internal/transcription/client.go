/*
Package transcription provides client interfaces and HTTP implementations
for communicating with the Spectra FastAPI AI transcription service.

Purpose:
  - Dispatches recorded audio files to the FastAPI AI service.
  - Receives timestamped, speaker-attributed transcript segments.
  - Enforces the "no fake success" rule with strict HTTP status validation.

Key Types and Functions:
  - Client (Interface)
  - HTTPClient (Struct)
  - MockClient (Struct)
  - NewHTTPClient(baseURL string, timeout time.Duration) *HTTPClient
  - NewMockClient() *MockClient
*/
package transcription

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	ErrAIServiceUnavailable = errors.New("ai transcription service unavailable")
	ErrTranscriptionFailed  = errors.New("ai transcription processing failed")
)

// Client abstracts speech-to-text processing for meetings.
type Client interface {
	TranscribeFile(ctx context.Context, meetingID string, audioPath string) (*TranscriptionResponse, error)
}

// HTTPClient communicates with the FastAPI AI Service over HTTP.
type HTTPClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewHTTPClient creates a new HTTPClient pointing to the AI Service base URL.
func NewHTTPClient(baseURL string, timeout time.Duration) *HTTPClient {
	baseURL = strings.TrimRight(baseURL, "/")
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	return &HTTPClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// TranscribeFile sends an audio file path reference to the AI Service for transcription.
func (c *HTTPClient) TranscribeFile(ctx context.Context, meetingID string, audioPath string) (*TranscriptionResponse, error) {
	if c.baseURL == "" {
		return nil, fmt.Errorf("%w: ai service url is not configured", ErrAIServiceUnavailable)
	}

	payload := TranscribeRequest{
		MeetingID: meetingID,
		AudioPath: audioPath,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal transcription request: %w", err)
	}

	endpoint := fmt.Sprintf("%s/v1/transcriptions", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to build transcription request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAIServiceUnavailable, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Detail string `json:"detail"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&errResp)
		msg := errResp.Detail
		if msg == "" {
			msg = fmt.Sprintf("status code %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("%w: %s", ErrTranscriptionFailed, msg)
	}

	var result TranscriptionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode transcription response: %w", err)
	}

	return &result, nil
}

// MockClient provides an in-memory controllable transcription client for tests.
type MockClient struct {
	mu           sync.Mutex
	CallCount    int
	ShouldFail   bool
	MockResponse *TranscriptionResponse
}

// NewMockClient creates a new MockClient.
func NewMockClient() *MockClient {
	return &MockClient{
		MockResponse: &TranscriptionResponse{
			MeetingID:       "mock-meeting-id",
			DurationSeconds: 10.0,
			Language:        "en",
			TotalSegments:   2,
			Segments: []SegmentDTO{
				{
					ID:          0,
					StartTimeMs: 0,
					EndTimeMs:   4500,
					Speaker:     "Speaker 1",
					Text:        "Welcome to the meeting.",
				},
				{
					ID:          1,
					StartTimeMs: 4600,
					EndTimeMs:   9800,
					Speaker:     "Speaker 2",
					Text:        "Let's review the architecture roadmap.",
				},
			},
		},
	}
}

// TranscribeFile returns the mocked response or error.
func (m *MockClient) TranscribeFile(_ context.Context, meetingID string, _ string) (*TranscriptionResponse, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.CallCount++
	if m.ShouldFail {
		return nil, ErrTranscriptionFailed
	}

	resp := *m.MockResponse
	resp.MeetingID = meetingID
	return &resp, nil
}

