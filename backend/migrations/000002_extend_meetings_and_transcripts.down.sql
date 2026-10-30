-- 000002_extend_meetings_and_transcripts.down.sql

DROP INDEX IF EXISTS idx_meetings_user_id;
DROP INDEX IF EXISTS idx_meetings_created_at;
DROP INDEX IF EXISTS idx_meetings_status;
DROP INDEX IF EXISTS idx_processing_jobs_meeting_id;
DROP INDEX IF EXISTS idx_transcript_segments_meeting_id;

DROP TABLE IF EXISTS processing_jobs;
DROP TABLE IF EXISTS transcript_segments;

ALTER TABLE meetings
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS audio_path,
  DROP COLUMN IF EXISTS calendar_event_id;

-- Note: We do not restore the old status check constraint
-- because it would break if new status values already exist.