package tests

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/transcription"
)

func TestHTTPClient_TranscribeFile_Success(t *testing.T) {
	mockResponse := transcription.TranscriptionResponse{
		MeetingID:       "meeting-123",
		DurationSeconds: 15.5,
		Language:        "en",
		TotalSegments:   2,
		Segments: []transcription.SegmentDTO{
			{
				ID:          0,
				StartTimeMs: 0,
				EndTimeMs:   5000,
				Speaker:     "Speaker 1",
				Text:        "Welcome to the meeting.",
			},
			{
				ID:          1,
				StartTimeMs: 5100,
				EndTimeMs:   12000,
				Speaker:     "Speaker 2",
				Text:        "Let's review the API contracts.",
			},
		},
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/transcriptions" {
			t.Errorf("Unexpected request: %s %s", r.Method, r.URL.Path)
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		var req transcription.TranscribeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("Failed to decode request body: %v", err)
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		if req.MeetingID != "meeting-123" {
			t.Errorf("Expected meeting_id 'meeting-123', got '%s'", req.MeetingID)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(mockResponse)
	}))
	defer ts.Close()

	client := transcription.NewHTTPClient(ts.URL, 5*time.Second)
	ctx := context.Background()

	resp, err := client.TranscribeFile(ctx, "meeting-123", "/app/recordings/test.wav")
	if err != nil {
		t.Fatalf("Expected successful transcription, got error: %v", err)
	}

	if resp.MeetingID != "meeting-123" {
		t.Errorf("Expected meeting_id 'meeting-123', got '%s'", resp.MeetingID)
	}
	if len(resp.Segments) != 2 {
		t.Errorf("Expected 2 segments, got %d", len(resp.Segments))
	}
	if resp.Segments[0].Text != "Welcome to the meeting." {
		t.Errorf("Expected first segment text 'Welcome to the meeting.', got '%s'", resp.Segments[0].Text)
	}
}

func TestHTTPClient_TranscribeFile_Failure(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"detail": "Audio decoding error: invalid header"}`))
	}))
	defer ts.Close()

	client := transcription.NewHTTPClient(ts.URL, 5*time.Second)
	ctx := context.Background()

	_, err := client.TranscribeFile(ctx, "meeting-fail", "/app/recordings/bad.wav")
	if err == nil {
		t.Fatal("Expected transcription error, got nil")
	}

	if !contains(err.Error(), "Audio decoding error") {
		t.Errorf("Expected error to contain 'Audio decoding error', got: %v", err)
	}
}

func TestMeetingService_ProcessMeetingAudio_EndToEnd(t *testing.T) {
	repo := meetings.NewInMemoryRepository()
	worker := meetings.NewMockWorkerClient()
	mockTranscriber := transcription.NewMockClient()

	service := meetings.NewService(repo, worker, "Spectra Test Bot")
	service.SetTranscriber(mockTranscriber)

	ctx := context.Background()

	// 1. Create meeting
	m, err := service.CreateAndStartMeeting(ctx, &meetings.CreateMeetingRequest{
		Title:      "Sprint Standup",
		MeetingURL: "https://meet.google.com/abc-defg-hij",
	})
	if err != nil {
		t.Fatalf("Failed to create meeting: %v", err)
	}

	// 2. Process audio
	completedMeeting, err := service.ProcessMeetingAudio(ctx, m.ID, "/app/recordings/abc.wav")
	if err != nil {
		t.Fatalf("Failed to process meeting audio: %v", err)
	}

	if completedMeeting.Status != meetings.StatusCompleted {
		t.Errorf("Expected status '%s', got '%s'", meetings.StatusCompleted, completedMeeting.Status)
	}

	// 3. Verify transcript retrieved from repo
	segments, err := service.GetTranscript(ctx, m.ID)
	if err != nil {
		t.Fatalf("Failed to retrieve transcript: %v", err)
	}

	if len(segments) != 2 {
		t.Errorf("Expected 2 transcript segments, got %d", len(segments))
	}
	if segments[0].Speaker != "Speaker 1" {
		t.Errorf("Expected Speaker 1, got %s", segments[0].Speaker)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || (len(s) > 0 && len(substr) > 0 && findSubstr(s, substr)))
}

func findSubstr(s, substr string) bool {
	for i := 0; i+len(substr) <= len(s); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

