/*
Package google manages Google OAuth 2.0 authentication and token exchange.

Purpose:
  - Generates secure authorization URLs for user consent.
  - Exchanges authorization codes for access and refresh tokens.
  - Enforces explicit user consent for Google Calendar read access.

Key Types and Functions:
  - OAuthService (Struct)
  - NewOAuthService(clientID, clientSecret, redirectURL, store) *OAuthService
  - GetAuthURL(state string) (string, error)
  - HandleCallback(ctx, code, userID) (*OAuthToken, error)
  - IsConfigured() bool
*/
package google

import (
	"context"
	"fmt"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	googlecalendar "google.golang.org/api/calendar/v3"
)

// OAuthService handles Google OAuth2 authorization and token persistence.
type OAuthService struct {
	oauthConfig *oauth2.Config
	tokenStore  TokenStore
	configured  bool
}

// NewOAuthService creates a new OAuthService instance.
func NewOAuthService(clientID, clientSecret, redirectURL string, store TokenStore) *OAuthService {
	clientID = strings.TrimSpace(clientID)
	clientSecret = strings.TrimSpace(clientSecret)
	redirectURL = strings.TrimSpace(redirectURL)

	configured := clientID != "" && clientSecret != "" && redirectURL != ""

	var cfg *oauth2.Config
	if configured {
		cfg = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.email",
				googlecalendar.CalendarReadonlyScope,
				googlecalendar.CalendarEventsReadonlyScope,
			},
			Endpoint: google.Endpoint,
		}
	}

	return &OAuthService{
		oauthConfig: cfg,
		tokenStore:  store,
		configured:  configured,
	}
}

// IsConfigured returns true if Google OAuth credentials exist in environment configuration.
func (s *OAuthService) IsConfigured() bool {
	return s.configured
}

// GetAuthURL generates the Google consent screen URL with offline access and prompt options.
func (s *OAuthService) GetAuthURL(state string) (string, error) {
	if !s.configured {
		return "", ErrOAuthNotConfigured
	}
	if strings.TrimSpace(state) == "" {
		return "", ErrInvalidStateToken
	}

	// Request offline access to receive a refresh token for long-term calendar syncing.
	return s.oauthConfig.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.ApprovalForce,
	), nil
}

// HandleCallback exchanges the OAuth authorization code for tokens and persists them.
func (s *OAuthService) HandleCallback(ctx context.Context, code string, userID string) (*OAuthToken, error) {
	if !s.configured {
		return nil, ErrOAuthNotConfigured
	}
	if strings.TrimSpace(code) == "" {
		return nil, fmt.Errorf("authorization code is empty")
	}
	if strings.TrimSpace(userID) == "" {
		userID = "default_user"
	}

	token, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange authorization code: %w", err)
	}

	modelToken := &OAuthToken{
		UserID:       userID,
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		Expiry:       token.Expiry,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := s.tokenStore.SaveToken(ctx, modelToken); err != nil {
		return nil, fmt.Errorf("failed to save oauth token: %w", err)
	}

	return modelToken, nil
}

// GetToken retrieves the stored token for a user.
func (s *OAuthService) GetToken(ctx context.Context, userID string) (*OAuthToken, error) {
	if strings.TrimSpace(userID) == "" {
		userID = "default_user"
	}
	return s.tokenStore.GetToken(ctx, userID)
}
