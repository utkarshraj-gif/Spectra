/*
Package google provides models and interfaces for Google OAuth 2.0 and Calendar operations.

Purpose:
  - Defines data structures for OAuth tokens, authentication state, and calendar events.
  - Formulates the token storage and client contracts according to ASD-STE100 rules.

Key Types:
  - OAuthToken
  - CalendarEvent
  - TokenStore (Interface)
  - InMemoryTokenStore (Struct)
*/
package google

import (
	"context"
	"errors"
	"sync"
	"time"

	"golang.org/x/oauth2"
)

var (
	ErrTokenNotFound     = errors.New("google oauth token not found")
	ErrOAuthNotConfigured = errors.New("google oauth credentials not configured")
	ErrInvalidStateToken = errors.New("invalid oauth state token")
)

// OAuthToken holds authenticated Google OAuth credentials for a user.
type OAuthToken struct {
	UserID       string    `json:"user_id"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	TokenType    string    `json:"token_type"`
	Expiry       time.Time `json:"expiry"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ToOAuth2Token converts an OAuthToken into an oauth2.Token instance.
func (t *OAuthToken) ToOAuth2Token() *oauth2.Token {
	return &oauth2.Token{
		AccessToken:  t.AccessToken,
		TokenType:    t.TokenType,
		RefreshToken: t.RefreshToken,
		Expiry:       t.Expiry,
	}
}

// CalendarEvent represents a scheduled meeting event fetched from Google Calendar.
type CalendarEvent struct {
	ID          string     `json:"id"`
	Summary     string     `json:"summary"`
	Description string     `json:"description,omitempty"`
	StartTime   *time.Time `json:"start_time,omitempty"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	MeetLink    string     `json:"meet_link,omitempty"`
	MeetCode    string     `json:"meet_code,omitempty"`
	HasBot      bool       `json:"has_bot"`
	Status      string     `json:"status"`
}

// TokenStore defines persistence for Google OAuth tokens.
type TokenStore interface {
	SaveToken(ctx context.Context, token *OAuthToken) error
	GetToken(ctx context.Context, userID string) (*OAuthToken, error)
	DeleteToken(ctx context.Context, userID string) error
}

// InMemoryTokenStore implements a thread-safe token repository in memory.
type InMemoryTokenStore struct {
	mu     sync.RWMutex
	tokens map[string]*OAuthToken
}

// NewInMemoryTokenStore creates an empty token store.
func NewInMemoryTokenStore() *InMemoryTokenStore {
	return &InMemoryTokenStore{
		tokens: make(map[string]*OAuthToken),
	}
}

// SaveToken stores or updates a user token.
func (s *InMemoryTokenStore) SaveToken(_ context.Context, token *OAuthToken) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cp := *token
	now := time.Now().UTC()
	if cp.CreatedAt.IsZero() {
		cp.CreatedAt = now
	}
	cp.UpdatedAt = now

	s.tokens[token.UserID] = &cp
	return nil
}

// GetToken retrieves a token by user ID.
func (s *InMemoryTokenStore) GetToken(_ context.Context, userID string) (*OAuthToken, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tok, exists := s.tokens[userID]
	if !exists {
		return nil, ErrTokenNotFound
	}

	cp := *tok
	return &cp, nil
}

// DeleteToken removes a user token from storage.
func (s *InMemoryTokenStore) DeleteToken(_ context.Context, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.tokens, userID)
	return nil
}
