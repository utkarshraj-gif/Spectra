/*
Package main is the entry point for the Spectra Backend REST API.

Purpose:
  - Loads configuration from environment variables.
  - Initializes repositories, Google OAuth services, and meeting worker clients.
  - Assembles the Gin HTTP router and starts the server.

Key Functions:
  - main()
*/
package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"spectrum-ai/backend/internal/calendar"
	"spectrum-ai/backend/internal/config"
	"spectrum-ai/backend/internal/google"
	"spectrum-ai/backend/internal/graph"
	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/router"
)

func main() {
	cfg := config.Load()

	// 1. Initialize meeting repository (In-memory ready; replaced by Mahi's PostgreSQL in Phase 4)
	meetingRepo := meetings.NewInMemoryRepository()

	// 2. Initialize meeting worker client (coordinates with Gagan's Playwright worker)
	var workerClient meetings.WorkerClient
	if cfg.WorkerServiceURL != "" {
		log.Printf("Connecting to Meeting Worker at %s", cfg.WorkerServiceURL)
		workerClient = meetings.NewHTTPWorkerClient(cfg.WorkerServiceURL, 15*time.Second)
	} else {
		log.Printf("WORKER_SERVICE_URL not configured: using mock worker coordinator")
		workerClient = meetings.NewMockWorkerClient()
	}

	// 3. Initialize domain services
	meetingService := meetings.NewService(meetingRepo, workerClient, cfg.DefaultBotName)

	// 4. Initialize Google OAuth and Calendar services
	tokenStore := google.NewInMemoryTokenStore()
	oauthService := google.NewOAuthService(
		cfg.GoogleClientID,
		cfg.GoogleClientSecret,
		cfg.GoogleRedirectURL,
		tokenStore,
	)
	calendarService := google.NewCalendarService(oauthService, meetingRepo)

	// 5. Initialize handlers
	calendarHandler := calendar.NewHandler(calendarService)
	googleAuthHandler := google.NewAuthHandler(oauthService)
	graphHandler := graph.NewHandler()

	// 6. Build Gin HTTP router
	engine := router.New(router.RouterDeps{
		MeetingService:  meetingService,
		CalendarHandler: calendarHandler,
		GoogleHandler:   googleAuthHandler,
		GraphHandler:    graphHandler,
		GinMode:         cfg.GinMode,
	})

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Spectra Backend REST API on %s (Gin mode: %s)", addr, cfg.GinMode)

	server := &http.Server{
		Addr:              addr,
		Handler:           engine,
		ReadHeaderTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed to start: %v", err)
	}
}
