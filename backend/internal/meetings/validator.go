/*
Package meetings provides Google Meet URL and meeting code validation routines.

Purpose:
  - Validates Google Meet URLs and meeting codes strictly to enforce the "no fake success" rule.
  - Normalizes input into canonical format (https://meet.google.com/xxx-yyyy-zzz) and extracts the meeting code.

Key Functions:
  - ValidateGoogleMeetURL(rawURL string) (canonicalURL string, meetingCode string, err error)
*/
package meetings

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var (
	// meetCodeRegex matches standard Google Meet codes: 3 lowercase letters, hyphen, 4 lowercase letters, hyphen, 3 lowercase letters.
	meetCodeRegex = regexp.MustCompile(`^[a-z]{3}-[a-z]{4}-[a-z]{3}$`)

	ErrEmptyURL       = errors.New("meeting URL cannot be empty")
	ErrInvalidDomain  = errors.New("invalid meeting domain: only Google Meet (meet.google.com) is supported")
	ErrInvalidCode    = errors.New("invalid Google Meet code: expected format xxx-yyyy-zzz (3-4-3 lowercase letters)")
	ErrMalformedURL   = errors.New("malformed meeting URL")
)

// ValidateGoogleMeetURL validates that a given URL or meeting code points to a legitimate Google Meet session.
// It accepts:
//   - https://meet.google.com/abc-defg-hij
//   - http://meet.google.com/abc-defg-hij
//   - meet.google.com/abc-defg-hij
//   - abc-defg-hij
//
// It strips query parameters, normalizes lowercase letters, and returns the canonical URL and code.
func ValidateGoogleMeetURL(rawInput string) (string, string, error) {
	trimmed := strings.TrimSpace(rawInput)
	if trimmed == "" {
		return "", "", ErrEmptyURL
	}

	// Case 1: Direct 10-letter meeting code (e.g., abc-defg-hij)
	if meetCodeRegex.MatchString(strings.ToLower(trimmed)) {
		code := strings.ToLower(trimmed)
		return fmt.Sprintf("https://meet.google.com/%s", code), code, nil
	}

	// Ensure scheme exists for parsing
	parsedInput := trimmed
	if !strings.HasPrefix(parsedInput, "http://") && !strings.HasPrefix(parsedInput, "https://") {
		parsedInput = "https://" + parsedInput
	}

	u, err := url.Parse(parsedInput)
	if err != nil {
		return "", "", fmt.Errorf("%w: %v", ErrMalformedURL, err)
	}

	// Validate Hostname
	host := strings.ToLower(u.Hostname())
	if host != "meet.google.com" {
		return "", "", fmt.Errorf("%w (got '%s')", ErrInvalidDomain, host)
	}

	// Validate Path segment (meeting code)
	path := strings.Trim(u.Path, "/")
	// In case there are subpaths or slashes, get the first segment
	segments := strings.Split(path, "/")
	if len(segments) == 0 || segments[0] == "" {
		return "", "", ErrInvalidCode
	}

	code := strings.ToLower(segments[0])
	if !meetCodeRegex.MatchString(code) {
		return "", "", fmt.Errorf("%w (got '%s')", ErrInvalidCode, code)
	}

	canonicalURL := fmt.Sprintf("https://meet.google.com/%s", code)
	return canonicalURL, code, nil
}
