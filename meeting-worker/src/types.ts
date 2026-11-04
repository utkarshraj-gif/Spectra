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
  passcode?: string;
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

export interface ParticipantEventPayload {
  participant_id: string;
  name: string;
  timestamp_ms: number;
}

export interface ChatMessagePayload {
  message_id?: string;
  sender: string;
  text: string;
  timestamp_ms: number;
}

export interface SessionStatusEvent {
  event:
    | 'STATE_CHANGE'
    | 'HEARTBEAT'
    | 'ERROR'
    | 'LOG'
    | 'AUDIO_READY'
    | 'TRANSCRIPT_SEGMENT'
    | 'SPEAKER_ACTIVE'
    | 'PARTICIPANT_JOINED'
    | 'PARTICIPANT_LEFT'
    | 'CHAT_MESSAGE';
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
  configurePreJoin(page: Page, botName: string, passcode?: string): Promise<void>;
  submitJoinRequest(page: Page, botName?: string): Promise<void>;
  waitForAdmission(
    page: Page,
    timeoutMs: number,
    onStateChange: (state: MeetingState, message: string) => void
  ): Promise<boolean>;
  leave(page: Page): Promise<void>;
  setupRosterObserver?(
    page: Page,
    onEvent: (type: 'JOINED' | 'LEFT', p: ParticipantEventPayload) => void
  ): Promise<void>;
  setupChatObserver?(
    page: Page,
    onMessage: (msg: ChatMessagePayload) => void
  ): Promise<void>;
}
