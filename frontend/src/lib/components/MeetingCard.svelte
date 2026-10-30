<script lang="ts">
  import type { Meeting } from '$lib/types';
  import StatusBadge from './StatusBadge.svelte';

  export let meeting: Meeting;

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
    <h3>{meeting.title || 'Untitled Meeting'}</h3>
    <p>{formatDate(meeting.created_at)}</p>
  </div>
  <StatusBadge status={meeting.status} />
</a>

<style>
  .meeting-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e293b;
    border: 1px solid #334155;
    padding: 1.25rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.15s;
  }
  .meeting-card:hover {
    border-color: #60a5fa;
  }
  h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
  }
  p {
    margin: 0;
    color: #94a3b8;
    font-size: 0.875rem;
  }
</style>