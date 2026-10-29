package calendar

import (
	"encoding/json"
	"net/http"
	"time"
)

type CalendarEvent struct {
	ID        string    `json:"id"`
	Summary   string    `json:"summary"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	MeetLink  string    `json:"meet_link"`
}

type CalendarHandler struct{}

func NewHandler() *CalendarHandler {
	return &CalendarHandler{}
}

func (h *CalendarHandler) ListEvents(w http.ResponseWriter, r *http.Request) {
	events := []CalendarEvent{
		{
			ID:        "cal_evt_1",
			Summary:   "Sprint Planning",
			StartTime: time.Now().Add(2 * time.Hour),
			EndTime:   time.Now().Add(3 * time.Hour),
			MeetLink:  "https://meet.google.com/xyz-uvw-rst",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
