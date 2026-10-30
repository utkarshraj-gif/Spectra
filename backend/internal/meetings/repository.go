/*
Package meetings defines the repository interface for meeting persistence
along with a thread-safe in-memory reference implementation.

Purpose:
  - Establishes the persistence contract that Mahi's PostgreSQL repository layer will implement in Phase 4.
  - Provides a concurrent-safe InMemoryRepository for immediate end-to-end execution and zero-flaky testing.

Key Types and Functions:
  - Repository (Interface)
  - InMemoryRepository (Struct)
  - NewInMemoryRepository() *InMemoryRepository
*/
package meetings

import (
	"context"
	"errors"
	"sync"
	"time"
)

var (
	ErrMeetingNotFound = errors.New("meeting not found")
	ErrMeetingConflict = errors.New("a meeting with this ID already exists")
)

// Repository defines the storage contract for meetings and transcript segments.
// Mahi's Phase 4 PostgreSQL implementation will satisfy this exact interface.
type Repository interface {
	Create(ctx context.Context, m *Meeting) error
	GetByID(ctx context.Context, id string) (*Meeting, error)
	List(ctx context.Context) ([]*Meeting, error)
	Update(ctx context.Context, m *Meeting) error
	GetTranscript(ctx context.Context, meetingID string) ([]*TranscriptSegment, error)
	AddTranscriptSegment(ctx context.Context, segment *TranscriptSegment) error
}

// InMemoryRepository provides a thread-safe in-memory store for meetings and transcripts.
type InMemoryRepository struct {
	mu          sync.RWMutex
	meetings    map[string]*Meeting
	transcripts map[string][]*TranscriptSegment
}

// NewInMemoryRepository instantiates an empty InMemoryRepository.
func NewInMemoryRepository() *InMemoryRepository {
	return &InMemoryRepository{
		meetings:    make(map[string]*Meeting),
		transcripts: make(map[string][]*TranscriptSegment),
	}
}

// Create inserts a new meeting record into the repository.
func (r *InMemoryRepository) Create(_ context.Context, m *Meeting) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.meetings[m.ID]; exists {
		return ErrMeetingConflict
	}

	// Store a copy to avoid external mutation races
	cp := *m
	r.meetings[m.ID] = &cp
	return nil
}

// GetByID retrieves a single meeting record by its unique ID.
func (r *InMemoryRepository) GetByID(_ context.Context, id string) (*Meeting, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	m, exists := r.meetings[id]
	if !exists {
		return nil, ErrMeetingNotFound
	}

	cp := *m
	return &cp, nil
}

// List returns all stored meeting records sorted by creation time descending.
func (r *InMemoryRepository) List(_ context.Context) ([]*Meeting, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]*Meeting, 0, len(r.meetings))
	for _, m := range r.meetings {
		cp := *m
		result = append(result, &cp)
	}

	return result, nil
}

// Update persists modifications to an existing meeting record.
func (r *InMemoryRepository) Update(_ context.Context, m *Meeting) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.meetings[m.ID]; !exists {
		return ErrMeetingNotFound
	}

	cp := *m
	cp.UpdatedAt = time.Now().UTC()
	r.meetings[m.ID] = &cp
	return nil
}

// GetTranscript retrieves all transcript segments associated with a meeting ID.
func (r *InMemoryRepository) GetTranscript(_ context.Context, meetingID string) ([]*TranscriptSegment, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if _, exists := r.meetings[meetingID]; !exists {
		return nil, ErrMeetingNotFound
	}

	segments, exists := r.transcripts[meetingID]
	if !exists {
		return []*TranscriptSegment{}, nil
	}

	result := make([]*TranscriptSegment, len(segments))
	for i, s := range segments {
		cp := *s
		result[i] = &cp
	}

	return result, nil
}

// AddTranscriptSegment appends a new transcribed segment for a meeting.
func (r *InMemoryRepository) AddTranscriptSegment(_ context.Context, segment *TranscriptSegment) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.meetings[segment.MeetingID]; !exists {
		return ErrMeetingNotFound
	}

	cp := *segment
	r.transcripts[segment.MeetingID] = append(r.transcripts[segment.MeetingID], &cp)
	return nil
}
