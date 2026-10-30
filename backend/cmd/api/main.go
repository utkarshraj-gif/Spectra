/*
Package main is the entry point for the Spectra Backend REST API.

Purpose:
  - Loads configuration from environment variables.
  - Initializes database placeholder, repositories, Google OAuth, and meeting worker clients.
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
	"spectrum-ai/backend/internal/database"
	"spectrum-ai/backend/internal/google"
	"spectrum-ai/backend/internal/graph"
	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/router"
	"spectrum-ai/backend/internal/worker"
)

func main() {
	cfg := config.Load()

	// 1. Initialize database (Placeholder ready for Phase 4)
	if cfg.DatabaseURL != "" {
		_, err := database.Connect(cfg.DatabaseURL)
		if err != nil {
			log.Printf("Warning: Database connection failed: %v", err)
		}
	}

	// 2. Initialize internal worker manager (Lifecycle & State tracking)
	workerMgr := worker.InitManager(cfg.WorkerServiceURL)
	log.Printf("Worker Manager initialized pointing to %s", cfg.WorkerServiceURL)
	workerMgr.OnStateChange(func(meetingID string, state worker.State, msg string) {
		log.Printf("[MeetingStateTransition] Meeting %s -> %s (%s)", meetingID, state, msg)
	})

	// 3. Initialize meeting repository (In-memory ready; replaced by PostgreSQL in Phase 4)
	meetingRepo := meetings.NewInMemoryRepository()

	// 4. Initialize meeting worker client (coordinates with Playwright worker)
	var workerClient meetings.WorkerClient
	if cfg.WorkerServiceURL != "" {
		log.Printf("Connecting to Meeting Worker at %s", cfg.WorkerServiceURL)
		workerClient = meetings.NewHTTPWorkerClient(cfg.WorkerServiceURL, 15*time.Second)
	} else {
		log.Printf("WORKER_SERVICE_URL not configured: using mock worker coordinator")
		workerClient = meetings.NewMockWorkerClient()
	}

	// 5. Initialize domain services
	meetingService := meetings.NewService(meetingRepo, workerClient, cfg.DefaultBotName)

	// 6. Initialize Google OAuth and Calendar services
	tokenStore := google.NewInMemoryTokenStore()
	oauthService := google.NewOAuthService(
		cfg.GoogleClientID,
		cfg.GoogleClientSecret,
		cfg.GoogleRedirectURL,
		tokenStore,
	)
	calendarService := google.NewCalendarService(oauthService, meetingRepo)

	// 7. Initialize handlers
	calendarHandler := calendar.NewHandler(calendarService)
	googleAuthHandler := google.NewAuthHandler(oauthService)
	graphHandler := graph.NewHandler()

	// 8. Build Gin HTTP router
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
