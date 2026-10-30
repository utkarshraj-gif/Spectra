/*
Package config handles environment configuration loading and defaults for the backend service.

Purpose:
  - Loads application configuration values from environment variables with sensible defaults.
  - Supports configurations for server port, worker service URL, default bot identity, and Google OAuth credentials.

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
	WorkerServiceURL   string
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

	workerURL := os.Getenv("WORKER_SERVICE_URL")

	botName := os.Getenv("DEFAULT_BOT_NAME")
	if botName == "" {
		botName = "Spectra Bot"
	}

	return &Config{
		Port:               port,
		GinMode:            ginMode,
		WorkerServiceURL:   workerURL,
		DefaultBotName:     botName,
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
	}
}
