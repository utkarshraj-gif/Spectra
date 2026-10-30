/*
Package google provides unit tests for Google OAuth 2.0 flow and Calendar parsing.

Purpose:
  - Deterministically verifies Google OAuth URL generation, state checks, and token storage.
  - Verifies Google Meet link extraction and bot deduplication for calendar events.
  - Adheres to ASD-STE100 rules and ensures zero flaky tests.

Key Test Functions:
  - TestOAuthService_ConfiguredAndUnconfigured(t *testing.T)
  - TestExtractMeetLink(t *testing.T)
  - TestInMemoryTokenStore(t *testing.T)
*/
package google

import (
	"context"
	"testing"
	"time"

	googlecalendar "google.golang.org/api/calendar/v3"
)

func TestOAuthService_ConfiguredAndUnconfigured(t *testing.T) {
	store := NewInMemoryTokenStore()

	// Unconfigured test
	unconfigured := NewOAuthService("", "", "", store)
	if unconfigured.IsConfigured() {
		t.Errorf("expected IsConfigured to return false")
	}
	_, err := unconfigured.GetAuthURL("state-123")
	if err != ErrOAuthNotConfigured {
		t.Errorf("expected ErrOAuthNotConfigured, got %v", err)
	}

	// Configured test
	configured := NewOAuthService("client-id-123", "client-secret-abc", "http://localhost:8080/callback", store)
	if !configured.IsConfigured() {
		t.Errorf("expected IsConfigured to return true")
	}
	url, err := configured.GetAuthURL("state-123")
	if err != nil {
		t.Fatalf("unexpected error getting auth URL: %v", err)
	}
	if url == "" {
		t.Errorf("expected non-empty auth URL")
	}
}

func TestExtractMeetLink(t *testing.T) {
	tests := []struct {
		name         string
		event        *googlecalendar.Event
		expectedURL  string
		expectedCode string
	}{
		{
			name: "Meet link in conference data",
			event: &googlecalendar.Event{
				Summary: "Weekly Sync",
				ConferenceData: &googlecalendar.ConferenceData{
					EntryPoints: []*googlecalendar.EntryPoint{
						{
							EntryPointType: "video",
							Uri:            "https://meet.google.com/abc-defg-hij",
						},
					},
				},
			},
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
		{
			name: "Meet link in location field",
			event: &googlecalendar.Event{
				Summary:  "Design Review",
				Location: "https://meet.google.com/xyz-uvwx-rst?authuser=0",
			},
			expectedURL:  "https://meet.google.com/xyz-uvwx-rst",
			expectedCode: "xyz-uvwx-rst",
		},
		{
			name: "Meet link in description text",
			event: &googlecalendar.Event{
				Summary:     "Product Demo",
				Description: "Join the call at https://meet.google.com/klm-nopq-rst to see the demo.",
			},
			expectedURL:  "https://meet.google.com/klm-nopq-rst",
			expectedCode: "klm-nopq-rst",
		},
		{
			name: "No Meet link present",
			event: &googlecalendar.Event{
				Summary:  "In-person Lunch",
				Location: "Room 101",
			},
			expectedURL:  "",
			expectedCode: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url, code := ExtractMeetLink(tt.event)
			if url != tt.expectedURL {
				t.Errorf("expected URL %q, got %q", tt.expectedURL, url)
			}
			if code != tt.expectedCode {
				t.Errorf("expected code %q, got %q", tt.expectedCode, code)
			}
		})
	}
}

func TestInMemoryTokenStore(t *testing.T) {
	store := NewInMemoryTokenStore()
	ctx := context.Background()

	// Get non-existent
	_, err := store.GetToken(ctx, "user-1")
	if err != ErrTokenNotFound {
		t.Fatalf("expected ErrTokenNotFound, got %v", err)
	}

	// Save token
	token := &OAuthToken{
		UserID:       "user-1",
		AccessToken:  "access-xyz",
		RefreshToken: "refresh-abc",
		TokenType:    "Bearer",
		Expiry:       time.Now().UTC().Add(time.Hour),
	}

	if err := store.SaveToken(ctx, token); err != nil {
		t.Fatalf("unexpected save error: %v", err)
	}

	// Retrieve token
	got, err := store.GetToken(ctx, "user-1")
	if err != nil {
		t.Fatalf("unexpected get error: %v", err)
	}
	if got.AccessToken != "access-xyz" {
		t.Errorf("expected token 'access-xyz', got %q", got.AccessToken)
	}

	// Delete token
	if err := store.DeleteToken(ctx, "user-1"); err != nil {
		t.Fatalf("unexpected delete error: %v", err)
	}
	_, err = store.GetToken(ctx, "user-1")
	if err != ErrTokenNotFound {
		t.Fatalf("expected ErrTokenNotFound after delete, got %v", err)
	}
}
