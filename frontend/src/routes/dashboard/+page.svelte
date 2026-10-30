<script lang="ts">
  import { onMount } from 'svelte';
  import { listMeetings } from '$lib/api/client';
  import type { Meeting } from '$lib/types';
  import MeetingCard from '$lib/components/MeetingCard.svelte';

  let meetings: Meeting[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      meetings = await listMeetings();
    } catch (e: any) {
      error = e.message || 'Failed to load meetings';
    } finally {
      loading = false;
    }
  });
</script>

<div class="dashboard">
  <div class="header">
    <h1>Dashboard</h1>
    <a href="/meetings/new" class="btn primary">+ New Meeting</a>
  </div>

  {#if loading}
    <p class="muted">Loading meetings…</p>
  {:else if error}
    <div class="error">{error}</div>
  {:else if meetings.length === 0}
    <div class="empty">
      <p>No meetings yet.</p>
      <a href="/meetings/new" class="btn primary">Start your first meeting</a>
    </div>
  {:else}
    <section class="section">
      <h2>Recent Meetings</h2>
      <div class="card-list">
        {#each meetings as meeting}
          <MeetingCard {meeting} />
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  .btn.primary {
    background: #3b82f6;
    color: white;
    text-decoration: none;
    padding: 0.75rem 1.25rem;
    border-radius: 6px;
    font-weight: 600;
  }
  .muted { color: #94a3b8; }
  .error {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 1rem;
    border-radius: 8px;
  }
  .empty {
    text-align: center;
    padding: 3rem;
    color: #94a3b8;
  }
  h2 { margin-bottom: 1rem; }
</style>