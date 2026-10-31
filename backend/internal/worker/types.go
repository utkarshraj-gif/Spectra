package worker

import "time"

// State represents the lifecycle state of a meeting bot session
type State string

const (
	StateScheduled           State = "SCHEDULED"
	StateInitializing        State = "INITIALIZING"
	StateNavigating          State = "NAVIGATING"
	StatePreJoin             State = "PRE_JOIN"
	StateWaitingForAdmission State = "WAITING_FOR_ADMISSION"
	StateInMeeting           State = "IN_MEETING"
	StateLeaving             State = "LEAVING"
	StateCallEnded           State = "CALL_ENDED"
	StateAdmissionDenied     State = "ADMISSION_DENIED"
	StateFailed              State = "FAILED"
)

// StartRequest is the payload sent to start a meeting worker session
type StartRequest struct {
	MeetingID  string `json:"meeting_id"`
	MeetingURL string `json:"meeting_url"`
	BotName    string `json:"bot_name,omitempty"`
}

// StopRequest is the payload sent to stop a meeting worker session
type StopRequest struct {
	MeetingID string `json:"meeting_id"`
	Reason    string `json:"reason,omitempty"`
}

// Event represents an event emitted by the meeting-worker
type Event struct {
	Event     string                 `json:"event"`
	MeetingID string                 `json:"meeting_id"`
	State     State                  `json:"state"`
	Timestamp int64                  `json:"timestamp"`
	Message   string                 `json:"message,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// SessionInfo holds the current in-memory status of an orchestrated meeting
type SessionInfo struct {
	MeetingID  string    `json:"meeting_id"`
	MeetingURL string    `json:"meeting_url"`
	State      State     `json:"state"`
	StartedAt  time.Time `json:"started_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	LastError  string    `json:"last_error,omitempty"`
}

