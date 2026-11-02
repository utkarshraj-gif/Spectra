/*
Package google provides calendar event retrieval and bot deduplication logic.

Purpose:
  - Fetches upcoming Google Calendar events using authenticated user tokens.
  - Extracts and normalizes Google Meet links using the meetings validator.
  - Correlates with active and scheduled meetings using meeting codes and event IDs to avoid duplicate bots.

Key Types and Functions:
  - CalendarService (Struct)
  - NewCalendarService(oauthService, meetingRepo) *CalendarService
  - ListUpcomingEvents(ctx, userID, maxResults) ([]*CalendarEvent, error)
  - GetEvent(ctx, userID, eventID) (*CalendarEvent, error)
  - ExtractMeetLink(event *googlecalendar.Event) (string, string)
*/
package google

import (
	"context"
	"fmt"
	"strings"
	"time"

	"spectrum-ai/backend/internal/meetings"

	googlecalendar "google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

// CalendarService manages interaction with Google Calendar API.
type CalendarService struct {
	oauthService *OAuthService
	meetingRepo  meetings.Repository
}

// NewCalendarService constructs a CalendarService instance.
func NewCalendarService(oauthService *OAuthService, meetingRepo meetings.Repository) *CalendarService {
	return &CalendarService{
		oauthService: oauthService,
		meetingRepo:  meetingRepo,
	}
}

// ListUpcomingEvents retrieves upcoming calendar events containing Google Meet links.
// It correlates with meeting records to flag if a bot is already scheduled (deduplication).
func (s *CalendarService) ListUpcomingEvents(ctx context.Context, userID string, maxResults int64) ([]*CalendarEvent, error) {
	if !s.oauthService.IsConfigured() {
		return nil, ErrOAuthNotConfigured
	}

	tok, err := s.oauthService.GetToken(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not authenticated with Google: %w", err)
	}

	tokenSource := s.oauthService.oauthConfig.TokenSource(ctx, tok.ToOAuth2Token())
	srv, err := googlecalendar.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar client: %w", err)
	}

	if maxResults <= 0 {
		maxResults = 25
	}

	now := time.Now().UTC().Format(time.RFC3339)
	eventsCall := srv.Events.List("primary").
		ShowDeleted(false).
		SingleEvents(true).
		TimeMin(now).
		MaxResults(maxResults).
		OrderBy("startTime")

	events, err := eventsCall.Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to list calendar events: %w", err)
	}

	// Retrieve active and scheduled meetings for deduplication check
	activeMeetings, _ := s.meetingRepo.List(ctx)
	existingMeetCodes := make(map[string]bool)
	existingEventIDs := make(map[string]bool)
	for _, m := range activeMeetings {
		if !m.Status.IsTerminal() {
			if m.MeetingCode != "" {
				existingMeetCodes[m.MeetingCode] = true
			}
			if m.CalendarEventID != "" {
				existingEventIDs[m.CalendarEventID] = true
			}
		}
	}

	var results []*CalendarEvent
	for _, item := range events.Items {
		meetURL, meetCode := ExtractMeetLink(item)

		var startTime, endTime *time.Time
		if item.Start != nil && item.Start.DateTime != "" {
			if t, err := time.Parse(time.RFC3339, item.Start.DateTime); err == nil {
				startTime = &t
			}
		}
		if item.End != nil && item.End.DateTime != "" {
			if t, err := time.Parse(time.RFC3339, item.End.DateTime); err == nil {
				endTime = &t
			}
		}

		hasBot := false
		if (meetCode != "" && existingMeetCodes[meetCode]) || (item.Id != "" && existingEventIDs[item.Id]) {
			hasBot = true
		}

		results = append(results, &CalendarEvent{
			ID:          item.Id,
			Summary:     item.Summary,
			Description: item.Description,
			StartTime:   startTime,
			EndTime:     endTime,
			MeetLink:    meetURL,
			MeetCode:    meetCode,
			HasBot:      hasBot,
			Status:      item.Status,
		})
	}

	return results, nil
}

// GetEvent retrieves a specific Google Calendar event by ID and evaluates Meet links & bot status.
func (s *CalendarService) GetEvent(ctx context.Context, userID, eventID string) (*CalendarEvent, error) {
	if !s.oauthService.IsConfigured() {
		return nil, ErrOAuthNotConfigured
	}

	tok, err := s.oauthService.GetToken(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not authenticated with Google: %w", err)
	}

	tokenSource := s.oauthService.oauthConfig.TokenSource(ctx, tok.ToOAuth2Token())
	srv, err := googlecalendar.NewService(ctx, option.WithTokenSource(tokenSource))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar client: %w", err)
	}

	item, err := srv.Events.Get("primary", eventID).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch calendar event: %w", err)
	}

	meetURL, meetCode := ExtractMeetLink(item)

	var startTime, endTime *time.Time
	if item.Start != nil && item.Start.DateTime != "" {
		if t, err := time.Parse(time.RFC3339, item.Start.DateTime); err == nil {
			startTime = &t
		}
	}
	if item.End != nil && item.End.DateTime != "" {
		if t, err := time.Parse(time.RFC3339, item.End.DateTime); err == nil {
			endTime = &t
		}
	}

	// Retrieve active meetings for deduplication
	activeMeetings, _ := s.meetingRepo.List(ctx)
	hasBot := false
	for _, m := range activeMeetings {
		if !m.Status.IsTerminal() {
			if (meetCode != "" && m.MeetingCode == meetCode) || (m.CalendarEventID != "" && m.CalendarEventID == item.Id) {
				hasBot = true
				break
			}
		}
	}

	return &CalendarEvent{
		ID:          item.Id,
		Summary:     item.Summary,
		Description: item.Description,
		StartTime:   startTime,
		EndTime:     endTime,
		MeetLink:    meetURL,
		MeetCode:    meetCode,
		HasBot:      hasBot,
		Status:      item.Status,
	}, nil
}

// ExtractMeetLink parses conference data or text description to extract a Google Meet link and code.
func ExtractMeetLink(item *googlecalendar.Event) (string, string) {
	if item == nil {
		return "", ""
	}

	// 1. Check conferenceData (direct Meet entry point)
	if item.ConferenceData != nil {
		for _, entry := range item.ConferenceData.EntryPoints {
			if entry.EntryPointType == "video" && strings.Contains(entry.Uri, "meet.google.com") {
				if canonical, code, err := meetings.ValidateGoogleMeetURL(entry.Uri); err == nil {
					return canonical, code
				}
			}
		}
	}

	// 2. Check location field
	if item.Location != "" && strings.Contains(item.Location, "meet.google.com") {
		if canonical, code, err := meetings.ValidateGoogleMeetURL(item.Location); err == nil {
			return canonical, code
		}
	}

	// 3. Check description field
	if item.Description != "" && strings.Contains(item.Description, "meet.google.com") {
		words := strings.Fields(item.Description)
		for _, w := range words {
			if strings.Contains(w, "meet.google.com") {
				if canonical, code, err := meetings.ValidateGoogleMeetURL(w); err == nil {
					return canonical, code
				}
			}
		}
	}

	return "", ""
}
