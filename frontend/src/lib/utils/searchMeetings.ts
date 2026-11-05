import type { Meeting, MeetingFiltersState, TranscriptSegment } from '$lib/types';

function platformOf(m: Meeting): string {
  const p = (m.platform || '').toLowerCase();
  if (p) return p;
  const url = (m.meeting_url || '').toLowerCase();
  if (url.includes('meet.google')) return 'google_meet';
  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('teams.microsoft') || url.includes('teams.live')) return 'teams';
  return 'unknown';
}

function inDateRange(iso: string | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from) {
    const start = new Date(from + 'T00:00:00').getTime();
    if (t < start) return false;
  }
  if (to) {
    const end = new Date(to + 'T23:59:59').getTime();
    if (t > end) return false;
  }
  return true;
}

/** Highlight query in plain text → simple HTML (use with {@html} carefully on trusted data) */
export function highlightText(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text);
  const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'ig');
  return escapeHtml(text).replace(re, '<mark>$1</mark>');
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function filterMeetings(
  meetings: Meeting[],
  filters: MeetingFiltersState,
  transcriptIndex?: Record<string, string> // meetingId -> joined transcript text
): Meeting[] {
  const q = filters.query.trim().toLowerCase();

  return meetings.filter((m) => {
    if (filters.platform !== 'all' && platformOf(m) !== filters.platform) return false;
    if (filters.status !== 'all' && m.status !== filters.status) return false;
    if (!inDateRange(m.created_at, filters.dateFrom, filters.dateTo)) return false;

    if (!q) return true;

    const title = (m.title || '').toLowerCase();
    const url = (m.meeting_url || '').toLowerCase();
    const body = transcriptIndex?.[m.id]?.toLowerCase() || '';

    return title.includes(q) || url.includes(q) || body.includes(q);
  });
}

export function buildTranscriptIndex(
  meetingId: string,
  segments: TranscriptSegment[]
): string {
  return segments.map((s) => s.text || '').join(' ');
}