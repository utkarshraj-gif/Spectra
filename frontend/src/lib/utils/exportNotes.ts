import type { Meeting, MeetingSummary, ActionItem, TranscriptSegment } from '$lib/types';

function formatTs(sec?: number | null) {
  if (sec == null || Number.isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildPlainText(opts: {
  meeting: Meeting;
  summary?: MeetingSummary | null;
  actionItems?: ActionItem[];
  segments?: TranscriptSegment[];
}): string {
  const { meeting, summary, actionItems = [], segments = [] } = opts;
  const lines: string[] = [];

  lines.push(meeting.title || 'Untitled Meeting');
  lines.push(meeting.meeting_url || '');
  lines.push(`Status: ${meeting.status}`);
  lines.push(`Created: ${meeting.created_at}`);
  lines.push('');

  if (summary?.executive_summary) {
    lines.push('=== Executive Summary ===');
    lines.push(summary.executive_summary);
    lines.push('');
  }

  if (summary?.key_decisions?.length) {
    lines.push('=== Key Decisions ===');
    summary.key_decisions.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }

  if (actionItems.length) {
    lines.push('=== Action Items ===');
    actionItems.forEach((a) => {
      lines.push(`- [${a.status}] ${a.text}${a.assignee ? ` (@${a.assignee})` : ''}`);
    });
    lines.push('');
  }

  if (segments.length) {
    lines.push('=== Transcript ===');
    segments.forEach((seg) => {
      const start = seg.start_seconds ?? (seg.start_time_ms != null ? seg.start_time_ms / 1000 : 0);
      const speaker = seg.speaker || seg.speaker_id || '';
      lines.push(`[${formatTs(start)}] ${speaker ? speaker + ': ' : ''}${seg.text}`);
    });
  }

  return lines.join('\n');
}

export function buildMarkdown(opts: {
  meeting: Meeting;
  summary?: MeetingSummary | null;
  actionItems?: ActionItem[];
  segments?: TranscriptSegment[];
}): string {
  const { meeting, summary, actionItems = [], segments = [] } = opts;
  const lines: string[] = [];

  lines.push(`# ${meeting.title || 'Untitled Meeting'}`);
  lines.push('');
  lines.push(`- **URL:** ${meeting.meeting_url || '—'}`);
  lines.push(`- **Status:** ${meeting.status}`);
  lines.push(`- **Created:** ${meeting.created_at}`);
  lines.push('');

  if (summary?.executive_summary) {
    lines.push('## Executive Summary');
    lines.push('');
    lines.push(summary.executive_summary);
    lines.push('');
  }

  if (summary?.key_decisions?.length) {
    lines.push('## Key Decisions');
    lines.push('');
    summary.key_decisions.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }

  if (actionItems.length) {
    lines.push('## Action Items');
    lines.push('');
    actionItems.forEach((a) => {
      const box = a.status === 'done' ? 'x' : ' ';
      lines.push(`- [${box}] ${a.text}${a.assignee ? ` (@${a.assignee})` : ''}`);
    });
    lines.push('');
  }

  if (segments.length) {
    lines.push('## Transcript');
    lines.push('');
    segments.forEach((seg) => {
      const start = seg.start_seconds ?? (seg.start_time_ms != null ? seg.start_time_ms / 1000 : 0);
      const speaker = seg.speaker || seg.speaker_id || 'Speaker';
      lines.push(`**[${formatTs(start)}] ${speaker}:** ${seg.text}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Open a print window — user can "Save as PDF" */
export function exportPdfViaPrint(title: string, bodyHtml: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; line-height: 1.5; color: #111; }
      h1 { font-size: 1.5rem; } h2 { font-size: 1.15rem; margin-top: 1.5rem; }
      pre { white-space: pre-wrap; }
    </style></head><body>
    <h1>${title}</h1>
    <pre>${bodyHtml.replace(/</g, '&lt;')}</pre>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
  w.document.close();
}