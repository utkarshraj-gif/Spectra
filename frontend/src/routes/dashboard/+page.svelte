<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { listMeetings, listCalendarEvents, joinCalendarEvent } from '$lib/api/client';
  import type { Meeting, CalendarEvent, CalendarSyncState } from '$lib/types';
  import MeetingCard from '$lib/components/MeetingCard.svelte';
  import CalendarEventCard from '$lib/components/CalendarEventCard.svelte';
  import CalendarSyncStatus from '$lib/components/CalendarSyncStatus.svelte';

  let meetings: Meeting[] = [];
  let events: CalendarEvent[] = [];
  let loadingMeetings = true;
  let loadingCalendar = true;
  let meetingsError = '';
  let calendarState: CalendarSyncState = 'loading';
  let calendarMessage = '';
  let joiningId: string | null = null;
  let joinError = '';

  onMount(async () => {
    // Meetings
    try {
      meetings = await listMeetings();
    } catch (e: any) {
      meetingsError = e.message || 'Failed to load meetings';
    } finally {
      loadingMeetings = false;
    }

    // Calendar
    try {
      const result = await listCalendarEvents();
      if (result.ok) {
        events = result.events;
        calendarState = 'connected';
      } else {
        calendarState = result.code;
        calendarMessage = result.message;
      }
    } catch (e: any) {
      calendarState = 'error';
      calendarMessage = e.message || 'Failed to load calendar';
    } finally {
      loadingCalendar = false;
    }
  });

  async function handleJoin(event: CalendarEvent) {
    joinError = '';
    joiningId = event.id;
    try {
      const res = await joinCalendarEvent(event.id);
      // Prefer redirect to the created meeting if backend returns an id
      const meetingId = res.meeting_id || res.id;
      if (meetingId) {
        goto(`/meetings/${meetingId}`);
        return;
      }
      // Otherwise mark as has_bot locally
      events = events.map((e) =>
        e.id === event.id ? { ...e, has_bot: true } : e
      );
    } catch (e: any) {
      joinError = e.message || 'Failed to start bot for this event';
    } finally {
      joiningId = null;
    }
  }
</script>

<div class="dashboard">
  <div class="header">
    <h1>Dashboard</h1>
    <a href="/meetings/new" class="btn btn-primary">+ New Meeting</a>
  </div>

  <!-- Calendar section -->
  <section class="section">
    <h2>Upcoming Calendar Events</h2>

    <CalendarSyncStatus state={loadingCalendar ? 'loading' : calendarState} message={calendarMessage} />

    {#if joinError}
      <div class="error">{joinError}</div>
    {/if}

    {#if loadingCalendar}
      <p class="muted">Loading calendar…</p>
    {:else if calendarState === 'connected' && events.length === 0}
      <div class="empty card">
        <p>No upcoming events with Meet links.</p>
      </div>
    {:else if calendarState === 'connected'}
      <div class="event-list">
        {#each events as event}
          <CalendarEventCard
            {event}
            joining={joiningId === event.id}
            onJoin={handleJoin}
          />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Recent meetings -->
  <section class="section">
    <h2>Recent Meetings</h2>

    {#if loadingMeetings}
      <p class="muted">Loading meetings…</p>
    {:else if meetingsError}
      <div class="error">{meetingsError}</div>
    {:else if meetings.length === 0}
      <div class="empty card">
        <p>No meetings yet.</p>
        <a href="/meetings/new" class="btn btn-primary">Start your first meeting</a>
      </div>
    {:else}
      <div class="card-list">
        {#each meetings as meeting}
          <MeetingCard {meeting} />
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .dashboard {
    max-width: 900px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.75rem;
  }
  .section {
    margin-bottom: 2.5rem;
  }
  h2 {
    margin: 0 0 1rem;
    font-size: 1.15rem;
  }
  .muted {
    color: var(--text-muted);
  }
  .error {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 0.85rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }
  .empty .btn {
    margin-top: 1rem;
  }
  .card-list {
    display: flex;
    flex-direction: column;
  }
</style>