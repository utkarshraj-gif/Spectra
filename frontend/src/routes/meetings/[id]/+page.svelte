<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import {
    getMeeting,
    getTranscript,
    stopMeeting,
    getSummary,
    getActionItems,
    getParticipants,
    updateActionItem
  } from '$lib/api/client';
  import type {
    Meeting,
    TranscriptSegment,
    MeetingSummary,
    ActionItem,
    ParticipantStats
  } from '$lib/types';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import TranscriptViewer from '$lib/components/TranscriptViewer.svelte';
  import SummaryViewer from '$lib/components/SummaryViewer.svelte';
  import ActionItemsViewer from '$lib/components/ActionItemsViewer.svelte';
  import ParticipantsViewer from '$lib/components/ParticipantsViewer.svelte';

  let meeting: Meeting | null = null;
  let segments: TranscriptSegment[] = [];
  let summary: MeetingSummary | null = null;
  let actionItems: ActionItem[] = [];
  let participants: ParticipantStats[] = [];
  let loading = true;
  let error = '';
  let stopping = false;
  let activeTab: 'transcript' | 'summary' | 'actions' | 'participants' = 'transcript';
  let pollInterval: ReturnType<typeof setInterval>;
  let transcriptEl: HTMLElement;

  $: meetingId = $page.params.id as string;

  async function load() {
    if (!meetingId) return;
    try {
      meeting = await getMeeting(meetingId);
      if (['completed', 'processing', 'recording'].includes(meeting.status)) {
        try {
          const res = await getTranscript(meetingId);
          segments = Array.isArray(res) ? res : (res as any).segments ?? [];
        } catch { /* not ready */ }
      }
      if (meeting.status === 'completed') {
        summary = await getSummary(meetingId);
        actionItems = await getActionItems(meetingId);
        participants = await getParticipants(meetingId);

        // Fallback demo data so UI is visible before backend is ready
        if (!summary) {
          summary = {
            meeting_id: meetingId,
            executive_summary:
              'The team reviewed Q4 priorities, confirmed API contracts, and assigned frontend polish to Mahi.',
            key_decisions: [
              'Ship Phase 5 UI this week',
              'Keep bot camera and mic disabled by default'
            ],
            action_items: [],
            topics: ['Roadmap', 'API', 'Frontend']
          };
        }
        if (actionItems.length === 0) {
          actionItems = [
            {
              id: '1',
              text: 'Finish meeting detail tabs',
              assignee: 'Mahi',
              status: 'in_progress',
              source_timestamp: 41
            },
            {
              id: '2',
              text: 'Wire calendar events on dashboard',
              assignee: 'Mahi',
              status: 'open',
              source_timestamp: 28
            }
          ];
        }
      }
    } catch (e: any) {
      error = e.message || 'Failed to load meeting';
    } finally {
      loading = false;
    }
  }

  function jumpToTimestamp(seconds: number) {
    activeTab = 'transcript';
    // Let the tab render, then scroll
    setTimeout(() => {
      const el = document.querySelector(`[data-start="${Math.floor(seconds)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  async function handleToggle(item: ActionItem) {
    actionItems = actionItems.map((a) => (a.id === item.id ? item : a));
    try {
      await updateActionItem(meetingId, item.id, { status: item.status });
    } catch {
      // Backend may not support PATCH yet – keep local state
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

    <!-- Tabs -->
    <div class="tabs">
      <button class:active={activeTab === 'transcript'} on:click={() => (activeTab = 'transcript')}>
        Transcript
      </button>
      <button class:active={activeTab === 'summary'} on:click={() => (activeTab = 'summary')}>
        Executive Summary
      </button>
      <button class:active={activeTab === 'actions'} on:click={() => (activeTab = 'actions')}>
        Action Items
      </button>
      <button class:active={activeTab === 'participants'} on:click={() => (activeTab = 'participants')}>
        Participants
      </button>
    </div>

    <div class="tab-panel card">
      {#if activeTab === 'transcript'}
        <div bind:this={transcriptEl}>
          <TranscriptViewer {segments} />
        </div>
      {:else if activeTab === 'summary'}
        <SummaryViewer {summary} onJumpToTimestamp={jumpToTimestamp} />
      {:else if activeTab === 'actions'}
        <ActionItemsViewer items={actionItems} onToggle={handleToggle} onJump={jumpToTimestamp} />
      {:else}
        <ParticipantsViewer {participants} />
      {/if}
    </div>
  </div>
{/if}

<style>
  .back-link {
    color: var(--accent);
    text-decoration: none;
    font-size: 0.875rem;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin: 1rem 0 1.5rem;
    gap: 1rem;
  }
  h1 { margin: 0.25rem 0; }
  .url { color: var(--text-muted); font-size: 0.9rem; word-break: break-all; }
  .actions { margin-bottom: 1.25rem; }
  .btn.danger {
    background: #7f1d1d;
    color: #fca5a5;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }
  .tabs {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .tabs button {
    background: var(--bg-muted);
    border: 1px solid var(--border);
    color: var(--text-muted);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9rem;
  }
  .tabs button.active {
    background: var(--primary);
    color: var(--primary-fg);
    border-color: var(--primary);
  }
  .tab-panel {
    padding: 1.25rem;
    min-height: 280px;
  }
  .error {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .muted { color: var(--text-muted); }
</style>