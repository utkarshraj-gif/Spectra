package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"spectrum-ai/backend/internal/calendar"
	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/router"
)

func TestDualRoutePrefixes(t *testing.T) {
	repo := meetings.NewInMemoryRepository()
	worker := meetings.NewMockWorkerClient()
	meetingService := meetings.NewService(repo, worker, "Spectra Bot")

	engine := router.New(router.RouterDeps{
		MeetingService: meetingService,
		GinMode:        "release",
	})

	// Test 1: GET /api/meetings
	req1 := httptest.NewRequest(http.MethodGet, "/api/meetings", nil)
	w1 := httptest.NewRecorder()
	engine.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("Expected 200 OK on /api/meetings, got %d", w1.Code)
	}

	// Test 2: GET /api/v1/meetings (Frontend client compatibility)
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/meetings", nil)
	w2 := httptest.NewRecorder()
	engine.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Errorf("Expected 200 OK on /api/v1/meetings, got %d", w2.Code)
	}
}

func TestMeeting_CalendarEventID_Persistence(t *testing.T) {
	repo := meetings.NewInMemoryRepository()
	worker := meetings.NewMockWorkerClient()
	meetingService := meetings.NewService(repo, worker, "Spectra Bot")

	engine := router.New(router.RouterDeps{
		MeetingService: meetingService,
		GinMode:        "release",
	})

	createPayload := meetings.CreateMeetingRequest{
		Title:           "Sprint Retrospective",
		MeetingURL:      "https://meet.google.com/xyz-uvwx-rst",
		CalendarEventID: "cal-event-9988",
	}

	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/meetings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var resp meetings.MeetingResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if resp.CalendarEventID != "cal-event-9988" {
		t.Errorf("Expected calendar_event_id 'cal-event-9988', got '%s'", resp.CalendarEventID)
	}

	// Verify persistence in repository
	saved, err := repo.GetByID(context.Background(), resp.ID)
	if err != nil {
		t.Fatalf("Failed to retrieve meeting from repo: %v", err)
	}
	if saved.CalendarEventID != "cal-event-9988" {
		t.Errorf("Expected repo meeting calendar_event_id 'cal-event-9988', got '%s'", saved.CalendarEventID)
	}
}

func TestCalendarEvent_Join_NotConfigured(t *testing.T) {
	repo := meetings.NewInMemoryRepository()
	worker := meetings.NewMockWorkerClient()
	meetingService := meetings.NewService(repo, worker, "Spectra Bot")
	calHandler := calendar.NewHandler(nil, meetingService)

	engine := router.New(router.RouterDeps{
		MeetingService:  meetingService,
		CalendarHandler: calHandler,
		GinMode:         "release",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/calendar/events/any-event-id/join", nil)
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Errorf("Expected 501 Not Implemented when calendar unconfigured, got %d", w.Code)
	}
}

