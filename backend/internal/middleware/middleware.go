/*
Package middleware provides HTTP middleware handlers for the Gin engine.

Purpose:
  - Configures Cross-Origin Resource Sharing (CORS) for frontend clients.
  - Adds request logging, timing instrumentation, and panic recovery.

Key Functions:
  - CORS() gin.HandlerFunc
  - Logger() gin.HandlerFunc
*/
package middleware

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// CORS handles Cross-Origin Resource Sharing headers for incoming requests.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// Logger logs each incoming request with method, path, status, and duration.
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		clientIP := c.ClientIP()
		method := c.Request.Method
		statusCode := c.Writer.Status()

		if raw != "" {
			path = path + "?" + raw
		}

		log.Printf("[GIN] %3d | %13v | %15s | %-7s %#v",
			statusCode,
			latency,
			clientIP,
			method,
			path,
		)
	}
}
