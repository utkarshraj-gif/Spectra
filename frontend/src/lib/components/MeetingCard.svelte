<script lang="ts">
  import type { Meeting } from '$lib/types';
  import StatusBadge from './StatusBadge.svelte';
  import { highlightText } from '$lib/utils/searchMeetings';

  export let meeting: Meeting;
  export let highlightQuery = '';

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<a href={`/meetings/${meeting.id}`} class="meeting-card">
  <div class="info">
    <h3>{@html highlightText(meeting.title || 'Untitled Meeting', highlightQuery)}</h3>
    <p>{formatDate(meeting.created_at)}</p>
  </div>
  <StatusBadge status={meeting.status} />
</a>

<style>
  .meeting-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-elevated, #ffffff);
    border: 1px solid var(--border, #e2e2e8);
    box-shadow: var(--card-shadow, 0 4px 24px rgba(0, 0, 0, 0.06));
    padding: 1.25rem 1.5rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    text-decoration: none;
    color: var(--text, #131316);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .meeting-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.1);
  }
  h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    color: var(--text, #131316);
    font-weight: 600;
  }
  p {
    margin: 0;
    color: var(--text-muted, #6b6b76);
    font-size: 0.875rem;
  }

  :global(mark) {
  background: #fde047;
  color: #111;
  padding: 0 0.1em;
  border-radius: 2px;
}
</style>