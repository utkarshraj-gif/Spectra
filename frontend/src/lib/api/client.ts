import type { Meeting, TranscriptSegment, CalendarEvent } from '$lib/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  // handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ---------- Meetings ----------

export async function createMeeting(data: { title: string; meeting_url: string }) {
  return apiRequest<Meeting>('/api/v1/meetings', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function listMeetings() {
  return apiRequest<Meeting[]>('/api/v1/meetings');
}

export async function getMeeting(id: string) {
  return apiRequest<Meeting>(`/api/v1/meetings/${id}`);
}

export interface TranscriptResponse {
  meeting_id: string;
  total: number;
  segments: TranscriptSegment[];
}

export async function getTranscript(id: string): Promise<TranscriptSegment[]> {
  const res = await apiRequest<TranscriptSegment[] | TranscriptResponse>(`/api/v1/meetings/${id}/transcript`);
  if (Array.isArray(res)) {
    return res;
  }
  return res.segments || [];
}

export async function stopMeeting(id: string) {
  return apiRequest<Meeting>(`/api/v1/meetings/${id}/stop`, {
    method: 'POST'
  });
}

export interface LiveMeetingEvent {
  type: 'TRANSCRIPT_SEGMENT' | 'STATE_CHANGE';
  meeting_id: string;
  payload: any;
}

export function subscribeMeetingEvents(
  meetingId: string,
  onEvent: (event: LiveMeetingEvent) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const url = `${API_BASE_URL}/api/v1/meetings/${meetingId}/live`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {
      // ignore non-JSON messages
    }
  };

  return () => {
    eventSource.close();
  };
}

import type { MeetingSummary, ActionItem, ParticipantStats } from '$lib/types';

export async function getSummary(id: string): Promise<MeetingSummary | null> {
  try {
    return await apiRequest<MeetingSummary>(`/api/v1/meetings/${id}/summary`);
  } catch {
    // Backend may not have this endpoint yet – return null so UI can show placeholder
    return null;
  }
}

export async function getActionItems(id: string): Promise<ActionItem[]> {
  try {
    const data = await apiRequest<{ action_items: ActionItem[] } | ActionItem[]>(
      `/api/v1/meetings/${id}/action-items`
    );
    return Array.isArray(data) ? data : data.action_items ?? [];
  } catch {
    return [];
  }
}

export async function updateActionItem(
  meetingId: string,
  itemId: string,
  patch: Partial<ActionItem>
) {
  return apiRequest<ActionItem>(`/api/v1/meetings/${meetingId}/action-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
}

export async function getParticipants(id: string): Promise<ParticipantStats[]> {
  try {
    return await apiRequest<ParticipantStats[]>(`/api/v1/participants?meeting_id=${id}`);
  } catch {
    return [];
  }
}

// ---------- Calendar ----------

export type CalendarEventsResult =
  | { ok: true; events: CalendarEvent[] }
  | { ok: false; code: 'not_configured' | 'unauthorized' | 'error'; message: string };

export async function listCalendarEvents(): Promise<CalendarEventsResult> {
  try {
    const data = await apiRequest<CalendarEvent[] | { events: CalendarEvent[] }>(
      '/api/v1/calendar/events'
    );
    const events = Array.isArray(data) ? data : data.events ?? [];
    return { ok: true, events };
  } catch (e: any) {
    const msg = e?.message || '';
    if (msg.includes('501') || msg.includes('CALENDAR_NOT_CONFIGURED') || msg.includes('not configured')) {
      return { ok: false, code: 'not_configured', message: 'Google Calendar is not configured yet.' };
    }
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      return { ok: false, code: 'unauthorized', message: 'Connect Google Calendar to see upcoming events.' };
    }
    return { ok: false, code: 'error', message: msg || 'Failed to load calendar events.' };
  }
}

export async function joinCalendarEvent(eventId: string) {
  return apiRequest<{ meeting_id?: string; id?: string; status?: string }>(
    `/api/v1/calendar/events/${eventId}/join`,
    { method: 'POST' }
  );
}

/** Optional: start Google OAuth (backend may expose this) */
export function getGoogleConnectUrl() {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  return `${base}/api/v1/auth/google`;
}