/*
Package meetings provides HTTP request handlers for meeting creation,
listing, stopping, and transcript retrieval using the Gin web framework.

Purpose:
  - Binds and validates HTTP request payloads for meeting operations.
  - Delegates execution to the meeting Service layer.
  - Translates domain errors into precise HTTP status codes (400, 404, 409, 502, 500).

Key Types and Functions:
  - Handler (Struct)
  - NewHandler(service *Service) *Handler
  - RegisterRoutes(r *gin.RouterGroup)
  - Create(c *gin.Context)
  - List(c *gin.Context)
  - GetByID(c *gin.Context)
  - Stop(c *gin.Context)
  - GetTranscript(c *gin.Context)
*/
package meetings

import (
	"errors"
	"net/http"

	"spectrum-ai/backend/internal/api"

	"github.com/gin-gonic/gin"
)

// Handler manages HTTP endpoints for the /api/meetings resource.
type Handler struct {
	service *Service
}

// NewHandler constructs a meetings Handler backed by the meeting Service.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers all meeting-related routes under the supplied router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/meetings", h.Create)
	rg.GET("/meetings", h.List)
	rg.GET("/meetings/:id", h.GetByID)
	rg.POST("/meetings/:id/stop", h.Stop)
	rg.GET("/meetings/:id/transcript", h.GetTranscript)
}

// Create handles POST /api/meetings: creates a meeting record and dispatches the bot.
func (h *Handler) Create(c *gin.Context) {
	var req CreateMeetingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		api.RespondError(c, http.StatusBadRequest, "INVALID_REQUEST_BODY", "Invalid request body: title and meeting_url are required", err.Error())
		return
	}

	meeting, err := h.service.CreateAndStartMeeting(c.Request.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrEmptyURL) || errors.Is(err, ErrInvalidDomain) || errors.Is(err, ErrInvalidCode) || errors.Is(err, ErrMalformedURL) {
			api.RespondError(c, http.StatusBadRequest, "INVALID_MEETING_URL", err.Error())
			return
		}
		if errors.Is(err, ErrWorkerJoinFailed) || errors.Is(err, ErrWorkerUnavailable) {
			api.RespondError(c, http.StatusBadGateway, "WORKER_DISPATCH_FAILED", err.Error())
			return
		}
		api.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to start meeting", err.Error())
		return
	}

	api.RespondJSON(c, http.StatusCreated, meeting.ToResponse())
}

// List handles GET /api/meetings: retrieves all stored meeting sessions.
func (h *Handler) List(c *gin.Context) {
	meetingsList, err := h.service.ListMeetings(c.Request.Context())
	if err != nil {
		api.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve meetings", err.Error())
		return
	}

	responses := make([]*MeetingResponse, len(meetingsList))
	for i, m := range meetingsList {
		responses[i] = m.ToResponse()
	}

	api.RespondJSON(c, http.StatusOK, responses)
}

// GetByID handles GET /api/meetings/:id: retrieves details of a specific meeting.
func (h *Handler) GetByID(c *gin.Context) {
	id := c.Param("id")
	meeting, err := h.service.GetMeeting(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrMeetingNotFound) {
			api.RespondError(c, http.StatusNotFound, "MEETING_NOT_FOUND", "Meeting not found")
			return
		}
		api.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve meeting", err.Error())
		return
	}

	api.RespondJSON(c, http.StatusOK, meeting.ToResponse())
}

// Stop handles POST /api/meetings/:id/stop: halts a running meeting bot session.
func (h *Handler) Stop(c *gin.Context) {
	id := c.Param("id")
	meeting, err := h.service.StopMeeting(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrMeetingNotFound) {
			api.RespondError(c, http.StatusNotFound, "MEETING_NOT_FOUND", "Meeting not found")
			return
		}
		if errors.Is(err, ErrMeetingAlreadyStopped) {
			api.RespondError(c, http.StatusConflict, "MEETING_ALREADY_STOPPED", err.Error())
			return
		}
		if errors.Is(err, ErrWorkerStopFailed) || errors.Is(err, ErrWorkerUnavailable) {
			api.RespondError(c, http.StatusBadGateway, "WORKER_STOP_FAILED", err.Error())
			return
		}
		api.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to stop meeting", err.Error())
		return
	}

	api.RespondJSON(c, http.StatusOK, meeting.ToResponse())
}

// GetTranscript handles GET /api/meetings/:id/transcript: returns meeting transcript chunks.
func (h *Handler) GetTranscript(c *gin.Context) {
	id := c.Param("id")
	segments, err := h.service.GetTranscript(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrMeetingNotFound) {
			api.RespondError(c, http.StatusNotFound, "MEETING_NOT_FOUND", "Meeting not found")
			return
		}
		api.RespondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve transcript", err.Error())
		return
	}

	resp := TranscriptResponse{
		MeetingID: id,
		Total:     len(segments),
		Segments:  segments,
	}

	api.RespondJSON(c, http.StatusOK, resp)
}
