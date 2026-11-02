/*
Package router configures the Gin HTTP engine, registers API routes,
and attaches middleware for CORS, logging, and error recovery.

Purpose:
  - Establishes the public-facing REST API contract using Gin.
  - Mounts health checks, meetings, calendar, google oauth, and graph endpoints.
  - Supports dual prefixes (/api and /api/v1) for frontend and backend compatibility.
  - Supports dependency injection for hermetic unit and end-to-end testing.

Key Types and Functions:
  - RouterDeps (Struct)
  - New(deps RouterDeps) *gin.Engine
*/
package router

import (
	"net/http"

	"spectrum-ai/backend/internal/api"
	"spectrum-ai/backend/internal/calendar"
	"spectrum-ai/backend/internal/google"
	"spectrum-ai/backend/internal/graph"
	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// RouterDeps defines the required dependencies for assembling the Gin router.
type RouterDeps struct {
	MeetingService  *meetings.Service
	CalendarHandler *calendar.Handler
	GoogleHandler   *google.AuthHandler
	GraphHandler    *graph.Handler
	GinMode         string
}

// New constructs and configures a Gin engine with all registered API routes.
func New(deps RouterDeps) *gin.Engine {
	if deps.GinMode != "" {
		gin.SetMode(deps.GinMode)
	}

	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(middleware.Logger())
	engine.Use(middleware.CORS())

	// Health check endpoint
	engine.GET("/health", func(c *gin.Context) {
		api.RespondJSON(c, http.StatusOK, gin.H{
			"status":  "ok",
			"service": "spectra-backend",
		})
	})

	// Mount routes on both /api and /api/v1 for complete frontend and backend compatibility
	for _, prefix := range []string{"/api", "/api/v1"} {
		rg := engine.Group(prefix)
		{
			// Meetings endpoints
			if deps.MeetingService != nil {
				meetingHandler := meetings.NewHandler(deps.MeetingService)
				meetingHandler.RegisterRoutes(rg)
			}

			// Calendar endpoints
			calHandler := deps.CalendarHandler
			if calHandler == nil {
				calHandler = calendar.NewHandler(nil, deps.MeetingService)
			}
			calHandler.RegisterRoutes(rg)

			// Google OAuth endpoints
			if deps.GoogleHandler != nil {
				deps.GoogleHandler.RegisterRoutes(rg)
			}

			// Graph endpoints (initially returns "not configured")
			grHandler := deps.GraphHandler
			if grHandler == nil {
				grHandler = graph.NewHandler()
			}
			grHandler.RegisterRoutes(rg)
		}
	}

	return engine
}
