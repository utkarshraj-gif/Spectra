/*
Package calendar provides handlers and services for Google Calendar integration.

Purpose:
  - Manages Google Calendar event discovery and bot scheduling.
  - Initially returns a clear "not configured" response until Phase 6 Google OAuth and Calendar APIs are enabled.

Key Types and Functions:
  - Handler (Struct)
  - NewHandler() *Handler
  - RegisterRoutes(rg *gin.RouterGroup)
  - ListEvents(c *gin.Context)
*/
package calendar

import (
	"net/http"

	"spectrum-ai/backend/internal/api"

	"github.com/gin-gonic/gin"
)

// Handler manages calendar-related endpoints.
type Handler struct{}

// NewHandler constructs a Calendar handler.
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes registers calendar routes on the router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/calendar/events", h.ListEvents)
}

// ListEvents handles GET /api/calendar/events.
// Initially returns a clear 501 Not Implemented / "not configured" status until Phase 6 Google Calendar API is integrated.
func (h *Handler) ListEvents(c *gin.Context) {
	api.RespondError(
		c,
		http.StatusNotImplemented,
		"CALENDAR_NOT_CONFIGURED",
		"Google Calendar integration is not configured. Google OAuth and Calendar API credentials required (Phase 6).",
	)
}
