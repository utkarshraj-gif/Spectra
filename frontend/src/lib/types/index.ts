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
  platform?: string | null;
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
  start_seconds?: number;
  end_seconds?: number;
  start_time_ms?: number;
  end_time_ms?: number;
  text: string;
  speaker?: string | null;
  speaker_id?: string | null;
  language?: string | null;
  model_name?: string | null;
  created_at?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string | null;
  due_date?: string | null;
  status: 'open' | 'in_progress' | 'done';
  source_timestamp?: number | null; // seconds in transcript
}

export interface MeetingSummary {
  meeting_id: string;
  executive_summary: string;
  key_decisions: string[];
  action_items: ActionItem[];
  topics?: string[];
}

export interface ParticipantStats {
  name: string;
  email?: string | null;
  speak_time_seconds: number;
  segment_count: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start_time?: string | null;
  end_time?: string | null;
  meet_link?: string | null;
  meet_code?: string | null;
  has_bot: boolean;
  status?: string;
}

export type CalendarSyncState =
  | 'connected'
  | 'not_configured'
  | 'unauthorized'
  | 'error'
  | 'loading';

  export interface UserPreferences {
  bot_name: string;
  auto_join_calendar: boolean;
  transcription_language: string;
  notify_on_complete: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  bot_name: 'Spectra Assistant',
  auto_join_calendar: false,
  transcription_language: 'en',
  notify_on_complete: true
};

export type MeetingPlatform = 'google_meet' | 'zoom' | 'teams' | 'unknown' | string;

export interface MeetingFiltersState {
  query: string;
  platform: 'all' | 'google_meet' | 'zoom' | 'teams';
  status: 'all' | MeetingStatus;
  dateFrom: string; // YYYY-MM-DD or ''
  dateTo: string;
}