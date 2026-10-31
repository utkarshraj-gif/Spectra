/*
Package meetings provides unit tests for Google Meet URL and meeting code validation.

Purpose:
  - Deterministically verifies Google Meet URL parsing, normalization, and error handling.
  - Ensures zero flaky tests and rigorous enforcement of the "no fake success" rule.

Key Test Functions:
  - TestValidateGoogleMeetURL_Valid(t *testing.T)
  - TestValidateGoogleMeetURL_Invalid(t *testing.T)
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
