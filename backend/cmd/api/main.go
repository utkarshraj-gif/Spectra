package main

import (
	"fmt"
	"log"
	"net/http"

	"spectrum-ai/backend/internal/config"
	"spectrum-ai/backend/internal/database"
	"spectrum-ai/backend/internal/router"
)

func main() {
	cfg := config.Load()

	// Initialize database
	_, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Printf("Warning: Database connection failed: %v", err)
	}

	// Initialize HTTP router
	appRouter := router.New()

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Starting Spectrum AI Backend API on %s", addr)

	if err := http.ListenAndServe(addr, appRouter); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}
