package transcription

// SegmentDTO represents a single transcribed chunk from the AI Service.
type SegmentDTO struct {
	ID          int    `json:"id"`
	StartTimeMs int64  `json:"start_time_ms"`
	EndTimeMs   int64  `json:"end_time_ms"`
	Speaker     string `json:"speaker"`
	Text        string `json:"text"`
}

// TranscriptionResponse represents the structured JSON returned by the AI Service.
type TranscriptionResponse struct {
	MeetingID       string       `json:"meeting_id"`
	DurationSeconds float64      `json:"duration_seconds"`
	Language        string       `json:"language"`
	TotalSegments   int          `json:"total_segments"`
	Segments        []SegmentDTO `json:"segments"`
}

// TranscribeRequest is the JSON payload sent when using shared volume file references.
type TranscribeRequest struct {
	MeetingID string `json:"meeting_id"`
	AudioPath string `json:"audio_path"`
}

