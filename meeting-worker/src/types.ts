export type MeetingState =
  | 'INITIALIZING'
  | 'NAVIGATING'
  | 'PRE_JOIN'
  | 'WAITING_FOR_ADMISSION'
  | 'IN_MEETING'
  | 'LEAVING'
  | 'CALL_ENDED'
  | 'ADMISSION_DENIED'
  | 'FAILED';

export interface StartSessionPayload {
  meeting_id: string;
  meeting_url: string;
  bot_name?: string;
}

export interface StopSessionPayload {
  meeting_id: string;
  reason?: string;
}

export interface SessionStatusEvent {
  event: 'STATE_CHANGE' | 'HEARTBEAT' | 'ERROR' | 'LOG';
  meeting_id: string;
  state: MeetingState;
  timestamp: number;
  message?: string;
  details?: Record<string, unknown>;
}

