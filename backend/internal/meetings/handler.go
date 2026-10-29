package meetings

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Meeting struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	MeetingURL string    `json:"meeting_url"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

type MeetingHandler struct{}

func NewHandler() *MeetingHandler {
	return &MeetingHandler{}
}

func (h *MeetingHandler) HandleMeetings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case http.MethodGet:
		meetings := []Meeting{
			{
				ID:         "1",
				Title:      "Product Architecture Sync",
				MeetingURL: "https://meet.google.com/abc-def-ghi",
				Status:     "completed",
				CreatedAt:  time.Now().Add(-24 * time.Hour),
			},
		}
		json.NewEncoder(w).Encode(meetings)

	case http.MethodPost:
		var m Meeting
		if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}
		m.ID = "mtg_" + time.Now().Format("20060102150405")
		m.Status = "scheduled"
		m.CreatedAt = time.Now()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(m)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *MeetingHandler) GetMeetingByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/v1/meetings/")
	m := Meeting{
		ID:         id,
		Title:      "Meeting " + id,
		MeetingURL: "https://meet.google.com/abc-def-ghi",
		Status:     "completed",
		CreatedAt:  time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}
