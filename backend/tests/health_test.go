package tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"spectrum-ai/backend/internal/router"
)

func TestHealthEndpoint(t *testing.T) {
	appRouter := router.New()

	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	appRouter.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	expected := `{"status":"ok","service":"spectrum-backend"}`
	if rr.Body.String() != expected {
		t.Errorf("Expected body %q, got %q", expected, rr.Body.String())
	}
}
