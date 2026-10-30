<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { getMeeting, getTranscript, stopMeeting } from '$lib/api/client';
  import type { Meeting, TranscriptSegment } from '$lib/types';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import TranscriptViewer from '$lib/components/TranscriptViewer.svelte';

  let meeting: Meeting | null = null;
  let segments: TranscriptSegment[] = [];
  let loading = true;
  let error = '';
  let stopping = false;

  let pollInterval: ReturnType<typeof setInterval>;

  // Guaranteed to be string inside this route
  $: meetingId = $page.params.id as string;

  async function load() {
    if (!meetingId) return;

    try {
      meeting = await getMeeting(meetingId);
      if (['completed', 'processing', 'recording'].includes(meeting.status)) {
        try {
          segments = await getTranscript(meetingId);
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

  onMount(() => {
    load();
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
        <h2>Transcript</h2>
        <TranscriptViewer {segments} />
      </div>

      <div class="side-panel">
        <h3>Details</h3>
        <ul>
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
    color: #60a5fa;
    text-decoration: none;
    font-size: 0.875rem;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin: 1rem 0 1.5rem;
  }
  h1 { margin: 0.25rem 0; }
  .url { color: #94a3b8; font-size: 0.9rem; word-break: break-all; }
  .actions { margin-bottom: 1.5rem; }
  .btn.danger {
    background: #7f1d1d;
    color: #fca5a5;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
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
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 1.5rem;
  }
  .error {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
  .muted { color: #94a3b8; }
  ul { padding-left: 1.25rem; color: #cbd5e1; }
  li { margin-bottom: 0.5rem; }
</style>