/*
Package google provides HTTP handlers for Google OAuth 2.0 authorization flows.

Purpose:
  - Serves GET /api/auth/google/login to initiate Google OAuth consent.
  - Serves GET /api/auth/google/callback to exchange authorization codes for tokens.
  - Adheres to ASD-STE100 rules for all error messages and responses.

Key Types and Functions:
  - AuthHandler (Struct)
  - NewAuthHandler(oauthService) *AuthHandler
  - RegisterRoutes(rg *gin.RouterGroup)
  - Login(c *gin.Context)
  - Callback(c *gin.Context)
*/
package google

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"

	"spectrum-ai/backend/internal/api"

	"github.com/gin-gonic/gin"
)

// AuthHandler coordinates Google OAuth authentication routes.
type AuthHandler struct {
	oauthService *OAuthService
}

// NewAuthHandler constructs an AuthHandler instance.
func NewAuthHandler(oauthService *OAuthService) *AuthHandler {
	return &AuthHandler{
		oauthService: oauthService,
	}
}

// RegisterRoutes mounts Google OAuth routes on the provided Gin router group.
func (h *AuthHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/auth/google/login", h.Login)
	rg.GET("/auth/google/callback", h.Callback)
}

// Login handles GET /api/auth/google/login: starts the Google consent flow.
func (h *AuthHandler) Login(c *gin.Context) {
	if !h.oauthService.IsConfigured() {
		api.RespondError(
			c,
			http.StatusNotImplemented,
			"OAUTH_NOT_CONFIGURED",
			"Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.",
		)
		return
	}

	// Generate secure random state token for CSRF protection
	stateBytes := make([]byte, 16)
	_, _ = rand.Read(stateBytes)
	state := hex.EncodeToString(stateBytes)

	authURL, err := h.oauthService.GetAuthURL(state)
	if err != nil {
		api.RespondError(c, http.StatusInternalServerError, "OAUTH_URL_ERROR", err.Error())
		return
	}

	api.RespondJSON(c, http.StatusOK, gin.H{
		"auth_url": authURL,
		"state":    state,
	})
}

// Callback handles GET /api/auth/google/callback: processes code exchange.
func (h *AuthHandler) Callback(c *gin.Context) {
	if !h.oauthService.IsConfigured() {
		api.RespondError(
			c,
			http.StatusNotImplemented,
			"OAUTH_NOT_CONFIGURED",
			"Google OAuth is not configured.",
		)
		return
	}

	code := c.Query("code")
	if code == "" {
		api.RespondError(c, http.StatusBadRequest, "MISSING_AUTH_CODE", "Authorization code query parameter is missing")
		return
	}

	userID := c.DefaultQuery("state", "default_user")

	token, err := h.oauthService.HandleCallback(c.Request.Context(), code, userID)
	if err != nil {
		if errors.Is(err, ErrOAuthNotConfigured) {
			api.RespondError(c, http.StatusNotImplemented, "OAUTH_NOT_CONFIGURED", err.Error())
			return
		}
		api.RespondError(c, http.StatusBadRequest, "OAUTH_EXCHANGE_FAILED", err.Error())
		return
	}

	api.RespondJSON(c, http.StatusOK, gin.H{
		"status":  "authenticated",
		"user_id": token.UserID,
		"expiry":  token.Expiry,
	})
}
