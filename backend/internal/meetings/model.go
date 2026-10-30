/*
Package meetings defines the core domain models, status enumerations,
and payload representations for meeting records and transcript segments.

Purpose:
  - Defines the Meeting entity, MeetingStatus state machine states, and TranscriptSegment.
  - Provides DTO requests and responses for API interactions.

Key Types and Constants:
  - MeetingStatus (StatusScheduled, StatusWaitingForAdmission, StatusJoined, StatusRecording, StatusProcessing, StatusCompleted, StatusFailed, StatusCancelled)
  - Meeting
  - TranscriptSegment
  - CreateMeetingRequest, MeetingResponse, TranscriptResponse
*/
package meetings

import (
	"time"
)

// MeetingStatus represents the lifecycle state of a meeting bot session.
type MeetingStatus string

const (
	StatusScheduled           MeetingStatus = "scheduled"
	StatusWaitingForAdmission MeetingStatus = "waiting_for_admission"
	StatusJoined              MeetingStatus = "joined"
	StatusRecording           MeetingStatus = "recording"
	StatusProcessing          MeetingStatus = "processing"
	StatusCompleted           MeetingStatus = "completed"
	StatusFailed              MeetingStatus = "failed"
	StatusCancelled           MeetingStatus = "cancelled"
)

// IsTerminal returns true if the meeting status is a final state.
func (s MeetingStatus) IsTerminal() bool {
	return s == StatusCompleted || s == StatusFailed || s == StatusCancelled
}

// Meeting represents a persistent meeting session and bot dispatch record.
type Meeting struct {
	ID            string        `json:"id"`
	Title         string        `json:"title"`
	MeetingURL    string        `json:"meeting_url"`
	MeetingCode   string        `json:"meeting_code"`
	Status        MeetingStatus `json:"status"`
	BotName       string        `json:"bot_name"`
	ScheduledAt   *time.Time    `json:"scheduled_at,omitempty"`
	StartedAt     *time.Time    `json:"started_at,omitempty"`
	EndedAt       *time.Time    `json:"ended_at,omitempty"`
	FailureReason string        `json:"failure_reason,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// TranscriptSegment represents a single transcribed chunk with speaker attribution.
type TranscriptSegment struct {
	ID          string    `json:"id"`
	MeetingID   string    `json:"meeting_id"`
	Speaker     string    `json:"speaker"`
	Text        string    `json:"text"`
	StartTimeMs int64     `json:"start_time_ms"`
	EndTimeMs   int64     `json:"end_time_ms"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateMeetingRequest represents the incoming JSON payload to create and start a meeting.
type CreateMeetingRequest struct {
	Title      string `json:"title" binding:"required"`
	MeetingURL string `json:"meeting_url" binding:"required"`
	BotName    string `json:"bot_name"`
}

// MeetingResponse represents the serialized meeting entity returned to clients.
type MeetingResponse struct {
	ID            string        `json:"id"`
	Title         string        `json:"title"`
	MeetingURL    string        `json:"meeting_url"`
	MeetingCode   string        `json:"meeting_code"`
	Status        MeetingStatus `json:"status"`
	BotName       string        `json:"bot_name"`
	ScheduledAt   *time.Time    `json:"scheduled_at,omitempty"`
	StartedAt     *time.Time    `json:"started_at,omitempty"`
	EndedAt       *time.Time    `json:"ended_at,omitempty"`
	FailureReason string        `json:"failure_reason,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// TranscriptResponse represents a list of transcript segments for a meeting.
type TranscriptResponse struct {
	MeetingID string               `json:"meeting_id"`
	Total     int                  `json:"total"`
	Segments  []*TranscriptSegment `json:"segments"`
}

// ToResponse converts a Meeting domain entity to its API response model.
func (m *Meeting) ToResponse() *MeetingResponse {
	return &MeetingResponse{
		ID:            m.ID,
		Title:         m.Title,
		MeetingURL:    m.MeetingURL,
		MeetingCode:   m.MeetingCode,
		Status:        m.Status,
		BotName:       m.BotName,
		ScheduledAt:   m.ScheduledAt,
		StartedAt:     m.StartedAt,
		EndedAt:       m.EndedAt,
		FailureReason: m.FailureReason,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}
