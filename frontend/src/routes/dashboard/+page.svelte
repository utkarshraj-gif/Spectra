<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    listMeetings,
    listCalendarEvents,
    joinCalendarEvent,
    getTranscript
  } from '$lib/api/client';
  import type {
    Meeting,
    CalendarEvent,
    CalendarSyncState,
    MeetingFiltersState
  } from '$lib/types';
  import MeetingCard from '$lib/components/MeetingCard.svelte';
  import CalendarEventCard from '$lib/components/CalendarEventCard.svelte';
  import CalendarSyncStatus from '$lib/components/CalendarSyncStatus.svelte';
  import MeetingFilters from '$lib/components/MeetingFilters.svelte';
  import { filterMeetings, buildTranscriptIndex } from '$lib/utils/searchMeetings';

  let meetings: Meeting[] = [];
  let events: CalendarEvent[] = [];
  let loadingMeetings = true;
  let loadingCalendar = true;
  let meetingsError = '';
  let calendarState: CalendarSyncState = 'loading';
  let calendarMessage = '';
  let joiningId: string | null = null;
  let joinError = '';
  let transcriptIndex: Record<string, string> = {};
  let indexing = false;

  let filters: MeetingFiltersState = {
    query: '',
    platform: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  };

  $: filtered = filterMeetings(meetings, filters, transcriptIndex);

  function handleFiltersChange(f: MeetingFiltersState) {
  filters = f;
  }

  onMount(async () => {
    try {
      meetings = await listMeetings();
    } catch (e: any) {
      meetingsError = e.message || 'Failed to load meetings';
    } finally {
      loadingMeetings = false;
    }
  
    
    // Optional: index a few recent completed meetings for transcript search
    indexing = true;
    const toIndex = meetings.filter((m) => m.status === 'completed').slice(0, 15);
    for (const m of toIndex) {
      try {
        const segs = await getTranscript(m.id);
        transcriptIndex[m.id] = buildTranscriptIndex(m.id, segs);
      } catch {
        /* skip */
      }
    }
    transcriptIndex = { ...transcriptIndex };
    indexing = false;

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
      const meetingId = res.meeting_id || res.id;
      if (meetingId) {
        goto(`/meetings/${meetingId}`);
        return;
      }
      events = events.map((e) => (e.id === event.id ? { ...e, has_bot: true } : e));
    } catch (e: any) {
      joinError = e.message || 'Failed to start bot';
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

  <section class="section">
    <h2>Upcoming Calendar Events</h2>
    <CalendarSyncStatus state={loadingCalendar ? 'loading' : calendarState} message={calendarMessage} />
    {#if joinError}<div class="error">{joinError}</div>{/if}
    {#if loadingCalendar}
      <p class="muted">Loading calendar…</p>
    {:else if calendarState === 'connected' && events.length === 0}
      <div class="empty card"><p>No upcoming events with Meet links.</p></div>
    {:else if calendarState === 'connected'}
      {#each events as event}
        <CalendarEventCard {event} joining={joiningId === event.id} onJoin={handleJoin} />
      {/each}
    {/if}
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Recent Meetings</h2>
      {#if indexing}<span class="muted small">Indexing transcripts for search…</span>{/if}
    </div>

    <MeetingFilters {filters} onChange={handleFiltersChange} />

    {#if loadingMeetings}
      <p class="muted">Loading meetings…</p>
    {:else if meetingsError}
      <div class="error">{meetingsError}</div>
    {:else if filtered.length === 0}
      <div class="empty card">
        <p>{meetings.length === 0 ? 'No meetings yet.' : 'No meetings match your filters.'}</p>
        {#if meetings.length === 0}
          <a href="/meetings/new" class="btn btn-primary">Start your first meeting</a>
        {/if}
      </div>
    {:else}
      <p class="muted count">{filtered.length} result{filtered.length === 1 ? '' : 's'}</p>
      <div class="card-list">
        {#each filtered as meeting}
          <MeetingCard {meeting} highlightQuery={filters.query} />
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .dashboard { max-width: 900px; margin: 0 auto; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    gap: 1rem;
  }
  h1 { margin: 0; font-size: 1.75rem; }
  .section { margin-bottom: 2.5rem; }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }
  h2 { margin: 0; font-size: 1.15rem; }
  .muted { color: var(--text-muted); }
  .small { font-size: 0.8rem; }
  .count { margin: 0 0 0.75rem; font-size: 0.85rem; }
  .error {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 0.85rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .empty { padding: 2rem; text-align: center; color: var(--text-muted); }
  .empty .btn { margin-top: 1rem; display: inline-flex; }
</style>