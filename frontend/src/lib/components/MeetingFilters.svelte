<script lang="ts">
  import type { MeetingFiltersState, MeetingStatus } from '$lib/types';
  import { Search } from 'lucide-svelte';

  export let filters: MeetingFiltersState;
  export let onChange: (f: MeetingFiltersState) => void = () => {};

  const statuses: Array<'all' | MeetingStatus> = [
    'all',
    'queued',
    'starting',
    'waiting_for_admission',
    'joined',
    'recording',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'scheduled',
    'in_progress'
  ];

  function patch(partial: Partial<MeetingFiltersState>) {
    onChange({ ...filters, ...partial });
  }

  function onQueryInput(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    patch({ query: value });
  }

  function onPlatformChange(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value as MeetingFiltersState['platform'];
    patch({ platform: value });
  }

  function onStatusChange(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value as MeetingFiltersState['status'];
    patch({ status: value });
  }

  function onFromChange(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    patch({ dateFrom: value });
  }

  function onToChange(e: Event) {
    const value = (e.currentTarget as HTMLInputElement).value;
    patch({ dateTo: value });
  }
</script>

<div class="filters card">
  <div class="search-row">
    <Search size={16} />
    <input
      type="search"
      placeholder="Search titles, URLs, or transcript text…"
      value={filters.query}
      on:input={onQueryInput}
    />
  </div>

  <div class="row">
    <label>
      Platform
      <select value={filters.platform} on:change={onPlatformChange}>
        <option value="all">All</option>
        <option value="google_meet">Google Meet</option>
        <option value="zoom">Zoom</option>
        <option value="teams">Teams</option>
      </select>
    </label>

    <label>
      Status
      <select value={filters.status} on:change={onStatusChange}>
        {#each statuses as s}
          <option value={s}>{s === 'all' ? 'All' : s.replaceAll('_', ' ')}</option>
        {/each}
      </select>
    </label>

    <label>
      From
      <input type="date" value={filters.dateFrom} on:change={onFromChange} />
    </label>

    <label>
      To
      <input type="date" value={filters.dateTo} on:change={onToChange} />
    </label>
  </div>
</div>

<style>
  .filters {
    padding: 1rem 1.15rem;
    margin-bottom: 1.25rem;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.35rem 0.75rem;
  }
  .search-row input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--text);
    padding: 0.5rem 0;
    font-size: 0.95rem;
    outline: none;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
  }
  select,
  input[type='date'] {
    padding: 0.5rem 0.6rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-muted);
    color: var(--text);
    font-size: 0.875rem;
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>