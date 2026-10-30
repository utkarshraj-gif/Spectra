/*
Package graph provides handlers for meeting knowledge graph generation.

Purpose:
  - Manages knowledge graph extraction and topic link creation for meetings.
  - Initially returns a clear "not configured" response until Phase 6 graph synthesis is connected.

Key Types and Functions:
  - Handler (Struct)
  - NewHandler() *Handler
  - RegisterRoutes(rg *gin.RouterGroup)
  - GenerateGraph(c *gin.Context)
*/
package graph

import (
	"fmt"
	"net/http"

	"spectrum-ai/backend/internal/api"

	"github.com/gin-gonic/gin"
)

// Handler manages knowledge graph endpoints.
type Handler struct{}

// NewHandler constructs a graph Handler.
func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes registers knowledge graph routes on the router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/meetings/:id/graph", h.GenerateGraph)
}

// GenerateGraph handles POST /api/meetings/:id/graph.
// Initially returns a clear 501 Not Implemented / "not configured" status.
func (h *Handler) GenerateGraph(c *gin.Context) {
	meetingID := c.Param("id")
	api.RespondError(
		c,
		http.StatusNotImplemented,
		"GRAPH_NOT_CONFIGURED",
		fmt.Sprintf("Knowledge graph generation is not configured for meeting %s. Feature planned for Phase 6.", meetingID),
	)
}
