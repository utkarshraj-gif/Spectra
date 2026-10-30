export interface User {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export type MeetingStatus =
  | 'queued'
  | 'starting'
  | 'waiting_for_admission'
  | 'joined'
  | 'recording'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'scheduled'      // legacy
  | 'in_progress';   // legacy

export interface Meeting {
  id: string;
  title: string;
  meeting_url: string;
  status: MeetingStatus;
  calendar_event_id?: string | null;
  audio_path?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Participant {
  id: string;
  meeting_id: string;
  name: string;
  email?: string;
}

export interface TranscriptSegment {
  id: string;
  meeting_id?: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  speaker_id?: string | null;
  language?: string | null;
  model_name?: string | null;
  created_at?: string;
}