/*
Package tests provides end-to-end integration tests for Google OAuth and Calendar endpoints.

Purpose:
  - Verifies GET /api/auth/google/login when unconfigured and configured.
  - Verifies GET /api/calendar/events when unconfigured and when user has not granted consent.
  - Adheres to ASD-STE100 rules and ensures zero flaky tests.

Key Test Functions:
  - TestGoogleOAuthEndpoints(t *testing.T)
  - TestCalendarEndpoints(t *testing.T)
*/
package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"spectrum-ai/backend/internal/calendar"
	"spectrum-ai/backend/internal/google"
	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/router"
)

func TestGoogleOAuthEndpoints(t *testing.T) {
	tokenStore := google.NewInMemoryTokenStore()

	// 1. Unconfigured router test
	unconfiguredOAuth := google.NewOAuthService("", "", "", tokenStore)
	unconfiguredAuthHandler := google.NewAuthHandler(unconfiguredOAuth)

	r := router.New(router.RouterDeps{
		GoogleHandler: unconfiguredAuthHandler,
		GinMode:       "test",
	})

	req, _ := http.NewRequest(http.MethodGet, "/api/auth/google/login", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 Not Implemented for unconfigured OAuth, got %d", w.Code)
	}

	// 2. Configured router test
	configuredOAuth := google.NewOAuthService("client-id", "secret", "http://localhost:8080/callback", tokenStore)
	configuredAuthHandler := google.NewAuthHandler(configuredOAuth)

	rConfigured := router.New(router.RouterDeps{
		GoogleHandler: configuredAuthHandler,
		GinMode:       "test",
	})

	req, _ = http.NewRequest(http.MethodGet, "/api/auth/google/login", nil)
	w = httptest.NewRecorder()
	rConfigured.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for configured OAuth, got %d: %s", w.Code, w.Body.String())
	}

	var res map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &res)
	if res["auth_url"] == "" {
		t.Errorf("expected auth_url in response")
	}
	if res["state"] == "" {
		t.Errorf("expected state token in response")
	}
}

func TestCalendarEndpoints(t *testing.T) {
	tokenStore := google.NewInMemoryTokenStore()
	meetingRepo := meetings.NewInMemoryRepository()

	// 1. Unconfigured Calendar test
	unconfiguredOAuth := google.NewOAuthService("", "", "", tokenStore)
	unconfiguredCalendarService := google.NewCalendarService(unconfiguredOAuth, meetingRepo)
	unconfiguredCalendarHandler := calendar.NewHandler(unconfiguredCalendarService)

	r := router.New(router.RouterDeps{
		CalendarHandler: unconfiguredCalendarHandler,
		GinMode:         "test",
	})

	req, _ := http.NewRequest(http.MethodGet, "/api/calendar/events", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501 Not Implemented when OAuth is not configured, got %d", w.Code)
	}

	// 2. Configured OAuth but user has not authorized (Consent Required test)
	configuredOAuth := google.NewOAuthService("client-id", "secret", "http://localhost:8080/callback", tokenStore)
	configuredCalendarService := google.NewCalendarService(configuredOAuth, meetingRepo)
	configuredCalendarHandler := calendar.NewHandler(configuredCalendarService)

	rConfigured := router.New(router.RouterDeps{
		CalendarHandler: configuredCalendarHandler,
		GinMode:         "test",
	})

	req, _ = http.NewRequest(http.MethodGet, "/api/calendar/events?user_id=unknown_user", nil)
	w = httptest.NewRecorder()
	rConfigured.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized when consent not granted, got %d: %s", w.Code, w.Body.String())
	}

	var errResp map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp["code"] != "GOOGLE_CONSENT_REQUIRED" {
		t.Errorf("expected code 'GOOGLE_CONSENT_REQUIRED', got %q", errResp["code"])
	}
}
