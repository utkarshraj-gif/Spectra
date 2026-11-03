<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { getMeeting, getTranscript, stopMeeting, subscribeMeetingEvents, type LiveMeetingEvent } from '$lib/api/client';
  import type { Meeting, TranscriptSegment } from '$lib/types';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import TranscriptViewer from '$lib/components/TranscriptViewer.svelte';

  let meeting: Meeting | null = null;
  let segments: TranscriptSegment[] = [];
  let loading = true;
  let error = '';
  let stopping = false;

  let pollInterval: ReturnType<typeof setInterval>;
  let unsubscribeLive: (() => void) | null = null;

  // Guaranteed to be string inside this route
  $: meetingId = $page.params.id as string;

  async function load() {
    if (!meetingId) return;

    try {
      meeting = await getMeeting(meetingId);
      if (['completed', 'processing', 'recording', 'joined'].includes(meeting.status)) {
        try {
          const fresh = await getTranscript(meetingId);
          if (fresh.length > 0) {
            segments = fresh;
          }
        } catch {
          // transcript may not be ready yet
        }
      }
    } catch (e: any) {
      error = e.message || 'Failed to load meeting';
    } finally {
      loading = false;
    }
  }

  function handleLiveEvent(event: LiveMeetingEvent) {
    if (event.type === 'TRANSCRIPT_SEGMENT' && event.payload) {
      const seg: TranscriptSegment = event.payload;
      if (!segments.some((s) => s.id === seg.id)) {
        segments = [...segments, seg];
      }
    } else if (event.type === 'STATE_CHANGE' && event.payload) {
      meeting = { ...meeting, ...event.payload };
    }
  }

  onMount(() => {
    load();
    if (meetingId) {
      unsubscribeLive = subscribeMeetingEvents(meetingId, handleLiveEvent);
    }
    pollInterval = setInterval(async () => {
      if (!meeting) return;
      if (['completed', 'failed', 'cancelled'].includes(meeting.status)) {
        clearInterval(pollInterval);
        return;
      }
      await load();
    }, 4000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
    if (unsubscribeLive) unsubscribeLive();
  });

  async function handleStop() {
    if (!meeting) return;
    stopping = true;
    try {
      meeting = await stopMeeting(meeting.id);
    } catch (e: any) {
      error = e.message;
    } finally {
      stopping = false;
    }
  }
</script>

{#if loading}
  <p class="muted">Loading meeting…</p>
{:else if error}
  <div class="error">{error}</div>
{:else if meeting}
  <div class="detail">
    <a href="/dashboard" class="back-link">← Back to Dashboard</a>

    <div class="header">
      <div>
        <h1>{meeting.title || 'Untitled Meeting'}</h1>
        <p class="url">{meeting.meeting_url}</p>
      </div>
      <StatusBadge status={meeting.status} />
    </div>

    {#if meeting.error_message}
      <div class="error">{meeting.error_message}</div>
    {/if}

    <div class="actions">
      {#if !['completed', 'failed', 'cancelled'].includes(meeting.status)}
        <button class="btn danger" on:click={handleStop} disabled={stopping}>
          {stopping ? 'Stopping…' : 'Stop Bot'}
        </button>
      {/if}
    </div>

    <div class="grid">
      <div class="main-panel">
        <h2>Live Transcript</h2>
        <TranscriptViewer {segments} />
      </div>

      <div class="side-panel">
        <h3>Details</h3>
        <ul>
          <li><strong>Platform:</strong> {meeting.platform || 'Google Meet'}</li>
          <li><strong>Status:</strong> {meeting.status}</li>
          <li><strong>Created:</strong> {new Date(meeting.created_at).toLocaleString()}</li>
          {#if meeting.started_at}
            <li><strong>Started:</strong> {new Date(meeting.started_at).toLocaleString()}</li>
          {/if}
          {#if meeting.ended_at}
            <li><strong>Ended:</strong> {new Date(meeting.ended_at).toLocaleString()}</li>
          {/if}
        </ul>
      </div>
    </div>
  </div>
{/if}

<style>
  .back-link {
    color: #2563eb;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin: 1rem 0 1.5rem;
  }
  h1 {
    color: var(--text, #131316);
    margin: 0.25rem 0;
  }
  h2, h3 {
    color: var(--text, #131316);
    margin-bottom: 0.75rem;
  }
  .url {
    color: var(--text-muted, #6b6b76);
    font-size: 0.9rem;
    word-break: break-all;
  }
  .actions {
    margin-bottom: 1.5rem;
  }
  .btn.danger {
    background: #dc2626;
    color: #ffffff;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.15s;
  }
  .btn.danger:hover {
    background: #b91c1c;
  }
  .grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
  }
  @media (max-width: 768px) {
    .grid { grid-template-columns: 1fr; }
  }
  .main-panel, .side-panel {
    background: var(--bg-elevated, #ffffff);
    border: 1px solid var(--border, #e2e2e8);
    border-radius: 12px;
    box-shadow: var(--card-shadow, 0 4px 24px rgba(0, 0, 0, 0.06));
    padding: 1.5rem;
    color: var(--text, #131316);
  }
  .error {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  .muted {
    color: var(--text-muted, #6b6b76);
  }
  ul {
    padding-left: 1.25rem;
    color: var(--text, #131316);
  }
  li {
    margin-bottom: 0.5rem;
  }
</style>
