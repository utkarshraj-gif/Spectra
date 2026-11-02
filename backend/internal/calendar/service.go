/*
Package calendar manages calendar event endpoints and Google Calendar operations.

Purpose:
  - Serves GET /api/calendar/events.
  - Serves POST /api/calendar/events/:id/join to dispatch bots directly from calendar events.
  - Returns clear "not configured" status when Google OAuth is inactive.
  - Retrieves upcoming Google Calendar events when authenticated.

Key Types and Functions:
  - Handler (Struct)
  - NewHandler(calendarService, meetingService) *Handler
  - RegisterRoutes(rg *gin.RouterGroup)
  - ListEvents(c *gin.Context)
  - JoinCalendarEvent(c *gin.Context)
*/
package calendar

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"spectrum-ai/backend/internal/api"
	"spectrum-ai/backend/internal/google"
	"spectrum-ai/backend/internal/meetings"

	"github.com/gin-gonic/gin"
)

// Handler coordinates calendar HTTP endpoints and bot dispatching.
type Handler struct {
	calendarService *google.CalendarService
	meetingService  *meetings.Service
}

// NewHandler constructs a Handler backed by the Google CalendarService and optional meetings Service.
func NewHandler(service *google.CalendarService, meetingService ...*meetings.Service) *Handler {
	var ms *meetings.Service
	if len(meetingService) > 0 {
		ms = meetingService[0]
	}
	return &Handler{
		calendarService: service,
		meetingService:  ms,
	}
}

// RegisterRoutes mounts calendar routes on the provided Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/calendar/events", h.ListEvents)
	rg.POST("/calendar/events/:id/join", h.JoinCalendarEvent)
}

// ListEvents handles GET /api/calendar/events.
// It returns 501 Not Implemented if Google OAuth is not configured.
// It returns 401 Unauthorized if the user has not authorized Google Calendar access.
func (h *Handler) ListEvents(c *gin.Context) {
	if h.calendarService == nil {
		api.RespondError(
			c,
			http.StatusNotImplemented,
			"CALENDAR_NOT_CONFIGURED",
			"Google Calendar integration is not configured. Google OAuth and Calendar API credentials required (Phase 6).",
		)
		return
	}

	userID := c.DefaultQuery("user_id", "default_user")
	limitStr := c.DefaultQuery("limit", "25")
	limit, _ := strconv.ParseInt(limitStr, 10, 64)

	events, err := h.calendarService.ListUpcomingEvents(c.Request.Context(), userID, limit)
	if err != nil {
		if errors.Is(err, google.ErrOAuthNotConfigured) {
			api.RespondError(
				c,
				http.StatusNotImplemented,
				"CALENDAR_NOT_CONFIGURED",
				"Google Calendar integration is not configured.",
			)
			return
		}
		if errors.Is(err, google.ErrTokenNotFound) {
			api.RespondError(
				c,
				http.StatusUnauthorized,
				"GOOGLE_CONSENT_REQUIRED",
				"User has not granted Google Calendar consent. Please authenticate via /api/auth/google/login",
			)
			return
		}
		api.RespondError(c, http.StatusInternalServerError, "CALENDAR_FETCH_FAILED", err.Error())
		return
	}

	api.RespondJSON(c, http.StatusOK, gin.H{
		"events": events,
		"total":  len(events),
	})
}

// JoinCalendarEvent handles POST /api/calendar/events/:id/join:
// Automatically dispatches a meeting worker bot to join the Google Meet session from the calendar event.
func (h *Handler) JoinCalendarEvent(c *gin.Context) {
	if h.calendarService == nil || h.meetingService == nil {
		api.RespondError(
			c,
			http.StatusNotImplemented,
			"CALENDAR_NOT_CONFIGURED",
			"Google Calendar integration or Meeting service is not configured.",
		)
		return
	}

	eventID := c.Param("id")
	userID := c.DefaultQuery("user_id", "default_user")

	var req struct {
		BotName string `json:"bot_name"`
	}
	_ = c.ShouldBindJSON(&req)

	event, err := h.calendarService.GetEvent(c.Request.Context(), userID, eventID)
	if err != nil {
		api.RespondError(c, http.StatusNotFound, "EVENT_NOT_FOUND", fmt.Sprintf("Calendar event not found: %v", err))
		return
	}

	if event.MeetLink == "" {
		api.RespondError(c, http.StatusBadRequest, "NO_MEET_LINK", "This calendar event does not contain a Google Meet link")
		return
	}

	if event.HasBot {
		api.RespondError(c, http.StatusConflict, "BOT_ALREADY_DISPATCHED", "A bot is already active or scheduled for this calendar meeting")
		return
	}

	title := event.Summary
	if title == "" {
		title = "Calendar Meeting"
	}

	meeting, err := h.meetingService.CreateAndStartMeeting(c.Request.Context(), &meetings.CreateMeetingRequest{
		Title:           title,
		MeetingURL:      event.MeetLink,
		BotName:         req.BotName,
		CalendarEventID: event.ID,
		ScheduledAt:     event.StartTime,
	})
	if err != nil {
		api.RespondError(c, http.StatusBadGateway, "BOT_DISPATCH_FAILED", fmt.Sprintf("Failed to dispatch bot: %v", err))
		return
	}

	api.RespondJSON(c, http.StatusCreated, meeting.ToResponse())
}
