-- 000002_extend_meetings_and_transcripts.up.sql

-- 1. Add missing columns to meetings
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. Expand allowed status values (keep old ones for compatibility)
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_status_check
  CHECK (status IN (
    'queued',
    'starting',
    'waiting_for_admission',
    'joined',
    'recording',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'scheduled',      -- old value (keep for now)
    'in_progress'     -- old value (keep for now)
  ));

-- 3. Better transcript segments table
CREATE TABLE IF NOT EXISTS transcript_segments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    start_seconds   DOUBLE PRECISION NOT NULL,
    end_seconds     DOUBLE PRECISION NOT NULL,
    text            TEXT NOT NULL,
    speaker_id      TEXT,
    language        TEXT,
    model_name      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting_id
  ON transcript_segments(meeting_id);

-- 4. Processing jobs table
CREATE TABLE IF NOT EXISTS processing_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    job_type        TEXT NOT NULL,               -- e.g. 'transcription', 'graph'
    status          TEXT NOT NULL DEFAULT 'pending',
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_meeting_id
  ON processing_jobs(meeting_id);

-- 5. Useful indexes
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);