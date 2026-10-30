/*
Package tests provides end-to-end HTTP integration tests for the Meetings API.

Purpose:
  - Verifies the entire public REST API contract for /api/meetings, /api/calendar, and /api/graph.
  - Enforces the "no fake success" rule across invalid URLs, non-existent records, and worker failures.
  - Uses the Gin router and in-memory test fixtures to ensure zero flaky tests.

Key Test Functions:
  - TestMeetingsAPI_FullLifecycle(t *testing.T)
  - TestMeetingsAPI_InvalidGoogleMeetURL(t *testing.T)
  - TestMeetingsAPI_WorkerFailure(t *testing.T)
  - TestMeetingsAPI_NotFound(t *testing.T)
  - TestMeetingsAPI_StopConflict(t *testing.T)
  - TestCalendarEndpoint_NotConfigured(t *testing.T)
  - TestGraphEndpoint_NotConfigured(t *testing.T)
*/
package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/router"

	"github.com/gin-gonic/gin"
)

// setupTestRouter instantiates an isolated Gin engine with fresh in-memory fixtures.
func setupTestRouter() (*gin.Engine, *meetings.InMemoryRepository, *meetings.MockWorkerClient) {
	repo := meetings.NewInMemoryRepository()
	worker := meetings.NewMockWorkerClient()
	service := meetings.NewService(repo, worker, "Spectra Test Bot")

	engine := router.New(router.RouterDeps{
		MeetingService: service,
		GinMode:        "test",
	})

	return engine, repo, worker
}

// TestMeetingsAPI_FullLifecycle tests creating, listing, getting, stopping, and transcript fetching.
func TestMeetingsAPI_FullLifecycle(t *testing.T) {
	engine, repo, worker := setupTestRouter()

	// 1. POST /api/meetings (Create and start)
	createBody := map[string]string{
		"title":       "Sprint Planning & Architecture",
		"meeting_url": "https://meet.google.com/abc-defg-hij?authuser=0",
		"bot_name":    "Spectra Assistant",
	}
	bodyBytes, _ := json.Marshal(createBody)

	req, _ := http.NewRequest(http.MethodPost, "/api/meetings", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var created meetings.MeetingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if created.ID == "" {
		t.Errorf("expected non-empty ID")
	}
	if created.MeetingURL != "https://meet.google.com/abc-defg-hij" {
		t.Errorf("expected canonical URL without query params, got %s", created.MeetingURL)
	}
	if created.MeetingCode != "abc-defg-hij" {
		t.Errorf("expected meeting code 'abc-defg-hij', got %s", created.MeetingCode)
	}
	if created.Status != meetings.StatusRecording {
		t.Errorf("expected status 'recording', got %s", created.Status)
	}
	if worker.JoinCallCount != 1 {
		t.Errorf("expected worker JoinCallCount to be 1, got %d", worker.JoinCallCount)
	}

	// 2. GET /api/meetings (List)
	req, _ = http.NewRequest(http.MethodGet, "/api/meetings", nil)
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on list, got %d", w.Code)
	}

	var list []*meetings.MeetingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("failed to decode list response: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 meeting in list, got %d", len(list))
	}
	if list[0].ID != created.ID {
		t.Errorf("expected meeting ID %s, got %s", created.ID, list[0].ID)
	}

	// 3. GET /api/meetings/:id (Get by ID)
	req, _ = http.NewRequest(http.MethodGet, fmt.Sprintf("/api/meetings/%s", created.ID), nil)
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on get by ID, got %d", w.Code)
	}

	var fetched meetings.MeetingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &fetched); err != nil {
		t.Fatalf("failed to decode get response: %v", err)
	}
	if fetched.ID != created.ID {
		t.Errorf("expected meeting ID %s, got %s", created.ID, fetched.ID)
	}

	// 4. Add transcript segment in repo
	_ = repo.AddTranscriptSegment(context.Background(), &meetings.TranscriptSegment{
		ID:          "seg-1",
		MeetingID:   created.ID,
		Speaker:     "Alex",
		Text:        "Welcome to the meeting.",
		StartTimeMs: 0,
		EndTimeMs:   3500,
		CreatedAt:   time.Now().UTC(),
	})

	// 5. GET /api/meetings/:id/transcript
	req, _ = http.NewRequest(http.MethodGet, fmt.Sprintf("/api/meetings/%s/transcript", created.ID), nil)
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on transcript, got %d", w.Code)
	}

	var transcriptResp meetings.TranscriptResponse
	if err := json.Unmarshal(w.Body.Bytes(), &transcriptResp); err != nil {
		t.Fatalf("failed to decode transcript response: %v", err)
	}
	if transcriptResp.Total != 1 {
		t.Errorf("expected 1 transcript segment, got %d", transcriptResp.Total)
	}
	if len(transcriptResp.Segments) > 0 && transcriptResp.Segments[0].Text != "Welcome to the meeting." {
		t.Errorf("unexpected transcript text: %s", transcriptResp.Segments[0].Text)
	}

	// 6. POST /api/meetings/:id/stop (Stop meeting)
	req, _ = http.NewRequest(http.MethodPost, fmt.Sprintf("/api/meetings/%s/stop", created.ID), nil)
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on stop, got %d: %s", w.Code, w.Body.String())
	}

	var stopped meetings.MeetingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &stopped); err != nil {
		t.Fatalf("failed to decode stop response: %v", err)
	}
	if stopped.Status != meetings.StatusCompleted {
		t.Errorf("expected status 'completed', got %s", stopped.Status)
	}
	if stopped.EndedAt == nil {
		t.Errorf("expected EndedAt timestamp to be populated")
	}
	if worker.StopCallCount != 1 {
		t.Errorf("expected worker StopCallCount to be 1, got %d", worker.StopCallCount)
	}
}

// TestMeetingsAPI_InvalidGoogleMeetURL verifies strict 400 Bad Request on invalid domains or formats.
func TestMeetingsAPI_InvalidGoogleMeetURL(t *testing.T) {
	engine, _, _ := setupTestRouter()

	invalidPayloads := []map[string]string{
		{"title": "Test Zoom", "meeting_url": "https://zoom.us/j/12345678"},
		{"title": "Test Teams", "meeting_url": "https://teams.microsoft.com/meeting/123"},
		{"title": "Test Malformed", "meeting_url": "https://meet.google.com/invalid-code"},
		{"title": "Empty URL", "meeting_url": ""},
	}

	for _, payload := range invalidPayloads {
		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, "/api/meetings", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for url %q, got %d", payload["meeting_url"], w.Code)
		}
	}
}

// TestMeetingsAPI_WorkerFailure tests the "no fake success" rule when the worker fails to join.
func TestMeetingsAPI_WorkerFailure(t *testing.T) {
	engine, _, worker := setupTestRouter()
	worker.ShouldFailJoin = true

	createBody := map[string]string{
		"title":       "Failing Meeting",
		"meeting_url": "https://meet.google.com/xyz-uvwx-rst",
	}
	bodyBytes, _ := json.Marshal(createBody)

	req, _ := http.NewRequest(http.MethodPost, "/api/meetings", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 Bad Gateway on worker dispatch failure, got %d: %s", w.Code, w.Body.String())
	}
}

// TestMeetingsAPI_NotFound tests 404 behavior for nonexistent IDs.
func TestMeetingsAPI_NotFound(t *testing.T) {
	engine, _, _ := setupTestRouter()

	endpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/meetings/non-existent-id"},
		{http.MethodPost, "/api/meetings/non-existent-id/stop"},
		{http.MethodGet, "/api/meetings/non-existent-id/transcript"},
	}

	for _, ep := range endpoints {
		req, _ := http.NewRequest(ep.method, ep.path, nil)
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 Not Found for %s %s, got %d", ep.method, ep.path, w.Code)
		}
	}
}

// TestMeetingsAPI_StopConflict verifies stopping an already completed meeting returns 409 Conflict.
func TestMeetingsAPI_StopConflict(t *testing.T) {
	engine, _, _ := setupTestRouter()

	// 1. Create meeting
	createBody := map[string]string{
		"title":       "Conflict Test",
		"meeting_url": "https://meet.google.com/abc-defg-hij",
	}
	bodyBytes, _ := json.Marshal(createBody)
	req, _ := http.NewRequest(http.MethodPost, "/api/meetings", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	var created meetings.MeetingResponse
	_ = json.Unmarshal(w.Body.Bytes(), &created)

	// 2. First stop (success)
	req, _ = http.NewRequest(http.MethodPost, fmt.Sprintf("/api/meetings/%s/stop", created.ID), nil)
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("first stop expected 200 OK, got %d", w.Code)
	}

	// 3. Second stop (conflict: already completed)
	req, _ = http.NewRequest(http.MethodPost, fmt.Sprintf("/api/meetings/%s/stop", created.ID), nil)
	w = httptest.NewRecorder()
	engine.ServeHTTP(w, req)
	if w.Code != http.StatusConflict {
		t.Fatalf("second stop expected 409 Conflict, got %d: %s", w.Code, w.Body.String())
	}
}

// TestCalendarEndpoint_NotConfigured verifies GET /api/calendar/events returns 501.
func TestCalendarEndpoint_NotConfigured(t *testing.T) {
	engine, _, _ := setupTestRouter()

	req, _ := http.NewRequest(http.MethodGet, "/api/calendar/events", nil)
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 Not Implemented, got %d", w.Code)
	}

	var errResp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp["code"] != "CALENDAR_NOT_CONFIGURED" {
		t.Errorf("expected code 'CALENDAR_NOT_CONFIGURED', got %v", errResp["code"])
	}
}

// TestGraphEndpoint_NotConfigured verifies POST /api/meetings/:id/graph returns 501.
func TestGraphEndpoint_NotConfigured(t *testing.T) {
	engine, _, _ := setupTestRouter()

	req, _ := http.NewRequest(http.MethodPost, "/api/meetings/123/graph", nil)
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 Not Implemented, got %d", w.Code)
	}

	var errResp map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp["code"] != "GRAPH_NOT_CONFIGURED" {
		t.Errorf("expected code 'GRAPH_NOT_CONFIGURED', got %v", errResp["code"])
	}
}
