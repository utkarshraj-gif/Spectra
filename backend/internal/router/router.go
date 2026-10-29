package router

import (
	"fmt"
	"net/http"
	"strings"

	"spectrum-ai/backend/internal/auth"
	"spectrum-ai/backend/internal/calendar"
	"spectrum-ai/backend/internal/meetings"
	"spectrum-ai/backend/internal/middleware"
	"spectrum-ai/backend/internal/participants"
	"spectrum-ai/backend/internal/users"
)

func New() http.Handler {
	mux := http.NewServeMux()

	authH := auth.NewHandler()
	userH := users.NewHandler()
	meetH := meetings.NewHandler()
	partH := participants.NewHandler()
	calH := calendar.NewHandler()

	// Health
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"spectrum-backend"}`)
	})

	// Auth routes
	mux.HandleFunc("/api/v1/auth/login", authH.Login)
	mux.HandleFunc("/api/v1/auth/register", authH.Register)

	// Users routes
	mux.HandleFunc("/api/v1/users/me", userH.GetProfile)

	// Meetings routes
	mux.HandleFunc("/api/v1/meetings", meetH.HandleMeetings)
	mux.HandleFunc("/api/v1/meetings/", func(w http.ResponseWriter, r *http.Request) {
		if strings.TrimPrefix(r.URL.Path, "/api/v1/meetings/") == "" {
			meetH.HandleMeetings(w, r)
			return
		}
		meetH.GetMeetingByID(w, r)
	})

	// Participants routes
	mux.HandleFunc("/api/v1/participants", partH.List)

	// Calendar routes
	mux.HandleFunc("/api/v1/calendar/events", calH.ListEvents)

	// Wrap middlewares
	handler := middleware.CORS(mux)
	handler = middleware.Logger(handler)

	return handler
}
