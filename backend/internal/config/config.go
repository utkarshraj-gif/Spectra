package config

import (
	"os"
)

type Config struct {
	Port             string
	DatabaseURL      string
	AIServiceURL     string
	WorkerServiceURL string
	JWTSecret        string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
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

	return &Config{
		Port:             port,
		DatabaseURL:      dbURL,
		AIServiceURL:     aiURL,
		WorkerServiceURL: workerURL,
		JWTSecret:        jwtSecret,
	}
}
