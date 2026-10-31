/*
Package api provides standardized HTTP responses, error payload definitions,
and helper utilities for Gin handlers across the Spectra backend.

Purpose:
  - Enforces the "no fake success" rule by standardizing error envelopes.
  - Formats HTTP responses consistently for client consumers.

Key Types and Functions:
  - ErrorResponse, DataResponse
  - RespondError(c *gin.Context, statusCode int, code string, message string, details ...string)
  - RespondJSON(c *gin.Context, statusCode int, data any)
*/
package api

import (
	"github.com/gin-gonic/gin"
)

// ErrorResponse represents a standardized JSON error envelope.
type ErrorResponse struct {
	Error   string   `json:"error"`
	Code    string   `json:"code,omitempty"`
	Details []string `json:"details,omitempty"`
}

// DataResponse wraps data payloads when envelope wrapping is preferred.
type DataResponse struct {
	Data any `json:"data"`
}

// RespondError writes a structured JSON error response to the client.
func RespondError(c *gin.Context, statusCode int, code string, message string, details ...string) {
	c.AbortWithStatusJSON(statusCode, ErrorResponse{
		Error:   message,
		Code:    code,
		Details: details,
	})
}

// RespondJSON writes an arbitrary payload with the provided status code.
func RespondJSON(c *gin.Context, statusCode int, data any) {
	c.JSON(statusCode, data)
}
