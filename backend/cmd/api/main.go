package main

import (
	"fmt"
	"log"
	"net/http"

	"spectrum-ai/backend/internal/config"
	"spectrum-ai/backend/internal/database"
	"spectrum-ai/backend/internal/router"
	"spectrum-ai/backend/internal/worker"
)

func main() {
	cfg := config.Load()

	// Initialize database
	_, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Printf("Warning: Database connection failed: %v", err)
	}

	// Initialize worker manager (Gagan - Lifecycle & Process Management)
	workerMgr := worker.InitManager(cfg.WorkerServiceURL)
	log.Printf("Worker Manager initialized pointing to %s", cfg.WorkerServiceURL)

	// Example state listener: Logs state machine transitions
	workerMgr.OnStateChange(func(meetingID string, state worker.State, msg string) {
		log.Printf("[MeetingStateTransition] Meeting %s -> %s (%s)", meetingID, state, msg)
	})

	// Initialize HTTP router
	appRouter := router.New()

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Spectrum AI Backend API on %s", addr)

	if err := http.ListenAndServe(addr, appRouter); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}
