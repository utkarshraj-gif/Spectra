import type { Page } from 'playwright';

export type MeetingPlatform = 'google_meet' | 'zoom' | 'teams' | 'generic';

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
  platform?: MeetingPlatform;
  bot_name?: string;
}

export interface StopSessionPayload {
  meeting_id: string;
  reason?: string;
}

export interface LiveTranscriptSegment {
  speaker: string;
  text: string;
  start_time_ms: number;
  end_time_ms: number;
  is_final: boolean;
}

export interface SessionStatusEvent {
  event: 'STATE_CHANGE' | 'HEARTBEAT' | 'ERROR' | 'LOG' | 'AUDIO_READY' | 'TRANSCRIPT_SEGMENT' | 'SPEAKER_ACTIVE';
  meeting_id: string;
  state: MeetingState;
  timestamp: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface PlatformAdapter {
  readonly platform: MeetingPlatform;
  matches(url: string): boolean;
  normalizeUrl(rawUrl: string): string;
  configurePreJoin(page: Page, botName: string): Promise<void>;
  submitJoinRequest(page: Page): Promise<void>;
  waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean>;
  leave(page: Page): Promise<void>;
}
