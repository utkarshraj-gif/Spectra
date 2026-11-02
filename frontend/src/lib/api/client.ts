import type { Meeting, TranscriptSegment } from '$lib/types';

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
