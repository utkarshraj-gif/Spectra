/*
Package meetings provides URL and meeting code validation routines across platforms.

Purpose:
  - Validates and normalizes meeting URLs across Google Meet, Zoom, Microsoft Teams, and generic WebRTC.
  - Enforces strict checks for Google Meet codes while permitting generic conference URLs.
  - Preserves backwards compatibility for ValidateGoogleMeetURL.

Key Functions:
  - ValidateMeetingURL(rawURL string) (platform MeetingPlatform, canonicalURL string, meetingCode string, err error)
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
	zoomIDRegex   = regexp.MustCompile(`[0-9]{9,11}`)

	ErrEmptyURL      = errors.New("meeting URL cannot be empty")
	ErrInvalidDomain = errors.New("invalid meeting domain: only Google Meet (meet.google.com) is supported")
	ErrInvalidCode   = errors.New("invalid Google Meet code: expected format xxx-yyyy-zzz (3-4-3 lowercase letters)")
	ErrMalformedURL  = errors.New("malformed meeting URL")
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
	if strings.Contains(parsedInput, "://") {
		if !strings.HasPrefix(parsedInput, "http://") && !strings.HasPrefix(parsedInput, "https://") {
			return "", "", fmt.Errorf("%w: unsupported scheme", ErrMalformedURL)
		}
	} else {
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

// ValidateMeetingURL normalizes and categorizes meeting URLs across Google Meet, Zoom, Teams, and generic platforms.
func ValidateMeetingURL(rawInput string) (MeetingPlatform, string, string, error) {
	trimmed := strings.TrimSpace(rawInput)
	if trimmed == "" {
		return "", "", "", ErrEmptyURL
	}

	// 1. Direct 10-letter Google Meet code
	if meetCodeRegex.MatchString(strings.ToLower(trimmed)) {
		code := strings.ToLower(trimmed)
		return PlatformGoogleMeet, fmt.Sprintf("https://meet.google.com/%s", code), code, nil
	}

	parsedInput := trimmed
	if strings.Contains(parsedInput, "://") {
		if !strings.HasPrefix(parsedInput, "http://") && !strings.HasPrefix(parsedInput, "https://") {
			return "", "", "", fmt.Errorf("%w: unsupported scheme", ErrMalformedURL)
		}
	} else {
		parsedInput = "https://" + parsedInput
	}

	u, err := url.Parse(parsedInput)
	if err != nil {
		return "", "", "", fmt.Errorf("%w: %v", ErrMalformedURL, err)
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return "", "", "", fmt.Errorf("%w: unsupported scheme '%s'", ErrMalformedURL, u.Scheme)
	}

	host := strings.ToLower(u.Hostname())
	if host == "" {
		return "", "", "", fmt.Errorf("%w: missing host", ErrMalformedURL)
	}

	// 2. Google Meet
	if host == "meet.google.com" {
		canonical, code, err := ValidateGoogleMeetURL(trimmed)
		if err != nil {
			return "", "", "", err
		}
		return PlatformGoogleMeet, canonical, code, nil
	}

	// 3. Zoom
	if strings.HasSuffix(host, "zoom.us") {
		path := strings.Trim(u.Path, "/")
		segments := strings.Split(path, "/")
		var code string
		for _, seg := range segments {
			if zoomIDRegex.MatchString(seg) {
				code = seg
				break
			}
		}
		if code == "" {
			code = u.Query().Get("id")
		}
		if code == "" {
			code = "zoom-meeting"
		}
		canonical := fmt.Sprintf("https://%s/j/%s", host, code)
		return PlatformZoom, canonical, code, nil
	}

	// 4. Microsoft Teams
	if strings.HasSuffix(host, "teams.microsoft.com") || strings.HasSuffix(host, "teams.live.com") {
		code := "teams-meeting"
		path := strings.Trim(u.Path, "/")
		segments := strings.Split(path, "/")
		if len(segments) > 0 && segments[len(segments)-1] != "" {
			code = segments[len(segments)-1]
		}
		return PlatformTeams, parsedInput, code, nil
	}

	// 5. Generic conference URL
	return PlatformGeneric, parsedInput, host, nil
}
