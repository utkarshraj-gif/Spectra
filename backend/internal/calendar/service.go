/*
Package calendar manages calendar event endpoints and Google Calendar operations.

Purpose:
  - Serves GET /api/calendar/events.
  - Returns clear "not configured" status when Google OAuth is inactive.
  - Retrieves upcoming Google Calendar events when authenticated.

Key Types and Functions:
  - Handler (Struct)
  - NewHandler(calendarService) *Handler
  - RegisterRoutes(rg *gin.RouterGroup)
  - ListEvents(c *gin.Context)
*/
package calendar

import (
	"errors"
	"net/http"
	"strconv"

	"spectrum-ai/backend/internal/api"
	"spectrum-ai/backend/internal/google"

	"github.com/gin-gonic/gin"
)

// Handler coordinates calendar HTTP endpoints.
type Handler struct {
	calendarService *google.CalendarService
}

// NewHandler constructs a Handler backed by the Google CalendarService.
func NewHandler(service *google.CalendarService) *Handler {
	return &Handler{
		calendarService: service,
	}
}

// RegisterRoutes mounts calendar routes on the provided Gin router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/calendar/events", h.ListEvents)
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
