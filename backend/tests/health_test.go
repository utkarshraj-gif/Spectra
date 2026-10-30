/*
Package tests provides end-to-end integration and API tests for the Spectra backend.

Purpose:
  - Verifies system endpoints such as GET /health using the Gin router and HTTP test recorders.
  - Ensures deterministic, non-flaky execution for continuous integration.

Key Test Functions:
  - TestHealthEndpoint(t *testing.T)
*/
package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"spectrum-ai/backend/internal/router"
)

func TestHealthEndpoint(t *testing.T) {
	appRouter := router.New(router.RouterDeps{
		GinMode: "test",
	})

	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	rr := httptest.NewRecorder()
	appRouter.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, rr.Code)
	}

	var res map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if res["status"] != "ok" {
		t.Errorf("Expected status 'ok', got %q", res["status"])
	}
	if res["service"] != "spectra-backend" {
		t.Errorf("Expected service 'spectra-backend', got %q", res["service"])
	}
}
