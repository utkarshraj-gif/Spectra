package participants

import (
	"encoding/json"
	"net/http"
)

type Participant struct {
	ID        string `json:"id"`
	MeetingID string `json:"meeting_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
}

type ParticipantHandler struct{}

func NewHandler() *ParticipantHandler {
	return &ParticipantHandler{}
}

func (h *ParticipantHandler) List(w http.ResponseWriter, r *http.Request) {
	list := []Participant{
		{ID: "p1", MeetingID: "1", Name: "Alice Smith", Email: "alice@company.com"},
		{ID: "p2", MeetingID: "1", Name: "Bob Jones", Email: "bob@company.com"},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}
