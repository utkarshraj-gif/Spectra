/*
Package config handles loading environment variables with defaults.

Purpose:
  - Defines the Config struct representing backend configuration parameters.
  - Exposes Load() to fetch environment variables or fallback values.

Key Types and Functions:
  - Config (Struct)
  - Load() *Config
*/
package config

import (
	"os"
)

// Config encapsulates backend service configuration values.
type Config struct {
	Port               string
	GinMode            string
	DatabaseURL        string
	AIServiceURL       string
	WorkerServiceURL   string
	JWTSecret          string
	DefaultBotName     string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
}

// Load reads configuration values from the OS environment, applying production-safe defaults.
func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = "release"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/spectra?sslmode=disable"
	}

	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8000"
	}

	workerURL := os.Getenv("WORKER_SERVICE_URL")
	if workerURL == "" {
		workerURL = "http://localhost:5001"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "super-secret-key-change-in-prod"
	}

	botName := os.Getenv("DEFAULT_BOT_NAME")
	if botName == "" {
		botName = "Spectra Bot"
	}

	return &Config{
		Port:               port,
		GinMode:            ginMode,
		DatabaseURL:        dbURL,
		AIServiceURL:       aiURL,
		WorkerServiceURL:   workerURL,
		JWTSecret:          jwtSecret,
		DefaultBotName:     botName,
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
	}
}
