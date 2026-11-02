/*
Package meetings provides unit tests for meeting URL and code validation across platforms.

Purpose:
  - Deterministically verifies Google Meet, Zoom, Teams, and generic conference URL parsing and normalization.
  - Ensures zero flaky tests and rigorous enforcement of the "no fake success" rule.
*/
package meetings

import (
	"testing"
)

func TestValidateGoogleMeetURL_Valid(t *testing.T) {
	tests := []struct {
		name         string
		input        string
		expectedURL  string
		expectedCode string
	}{
		{
			name:         "Standard HTTPS URL",
			input:        "https://meet.google.com/abc-defg-hij",
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
		{
			name:         "URL with query parameters and authuser",
			input:        "https://meet.google.com/abc-defg-hij?authuser=1&hs=179",
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
		{
			name:         "HTTP URL without scheme",
			input:        "meet.google.com/abc-defg-hij",
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
		{
			name:         "Uppercase letters in code",
			input:        "https://meet.google.com/ABC-DEFG-HIJ",
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
		{
			name:         "Direct 10-letter code without domain",
			input:        "abc-defg-hij",
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
		{
			name:         "URL with trailing slash and whitespace",
			input:        "  https://meet.google.com/abc-defg-hij/  ",
			expectedURL:  "https://meet.google.com/abc-defg-hij",
			expectedCode: "abc-defg-hij",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			canonicalURL, code, err := ValidateGoogleMeetURL(tt.input)
			if err != nil {
				t.Fatalf("expected no error, got: %v", err)
			}
			if canonicalURL != tt.expectedURL {
				t.Errorf("expected canonical URL %q, got %q", tt.expectedURL, canonicalURL)
			}
			if code != tt.expectedCode {
				t.Errorf("expected meeting code %q, got %q", tt.expectedCode, code)
			}
		})
	}
}

func TestValidateGoogleMeetURL_Invalid(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectedErr error
	}{
		{
			name:        "Empty string",
			input:       "",
			expectedErr: ErrEmptyURL,
		},
		{
			name:        "Whitespace only",
			input:       "    ",
			expectedErr: ErrEmptyURL,
		},
		{
			name:        "Non-Google domain (Zoom)",
			input:       "https://zoom.us/j/1234567890",
			expectedErr: ErrInvalidDomain,
		},
		{
			name:        "Non-Google domain (Teams)",
			input:       "https://teams.microsoft.com/l/meetup-join/123",
			expectedErr: ErrInvalidDomain,
		},
		{
			name:        "Wrong code segment count (too short)",
			input:       "https://meet.google.com/abc-defg",
			expectedErr: ErrInvalidCode,
		},
		{
			name:        "Numbers in meeting code",
			input:       "https://meet.google.com/abc-1234-hij",
			expectedErr: ErrInvalidCode,
		},
		{
			name:        "Missing code path on meet.google.com",
			input:       "https://meet.google.com/",
			expectedErr: ErrInvalidCode,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := ValidateGoogleMeetURL(tt.input)
			if err == nil {
				t.Fatalf("expected error for input %q, got nil", tt.input)
			}
		})
	}
}

func TestValidateMeetingURL_Platforms(t *testing.T) {
	tests := []struct {
		name             string
		input            string
		expectedPlatform MeetingPlatform
		expectedCode     string
	}{
		{
			name:             "Google Meet URL",
			input:            "https://meet.google.com/abc-defg-hij",
			expectedPlatform: PlatformGoogleMeet,
			expectedCode:     "abc-defg-hij",
		},
		{
			name:             "Zoom URL",
			input:            "https://zoom.us/j/1234567890?pwd=abc",
			expectedPlatform: PlatformZoom,
			expectedCode:     "1234567890",
		},
		{
			name:             "Microsoft Teams URL",
			input:            "https://teams.microsoft.com/l/meetup-join/19:meeting_xyz",
			expectedPlatform: PlatformTeams,
			expectedCode:     "19:meeting_xyz",
		},
		{
			name:             "Generic WebRTC room",
			input:            "https://call.example.com/room123",
			expectedPlatform: PlatformGeneric,
			expectedCode:     "call.example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			platform, _, code, err := ValidateMeetingURL(tt.input)
			if err != nil {
				t.Fatalf("expected no error for %s, got: %v", tt.input, err)
			}
			if platform != tt.expectedPlatform {
				t.Errorf("expected platform %s, got %s", tt.expectedPlatform, platform)
			}
			if code != tt.expectedCode {
				t.Errorf("expected code %s, got %s", tt.expectedCode, code)
			}
		})
	}
}
