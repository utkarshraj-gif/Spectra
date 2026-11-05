<script lang="ts">
  import type { CalendarEvent } from '$lib/types';
  import { Calendar, Video, Bot } from 'lucide-svelte';

  export let event: CalendarEvent;
  export let joining = false;
  export let onJoin: (event: CalendarEvent) => void = () => {};

  function formatWhen(iso?: string | null) {
    if (!iso) return 'Time TBD';
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="card event">
  <div class="left">
    <div class="icon">
      <Calendar size={18} />
    </div>
    <div class="info">
      <h3>{event.summary || 'Untitled event'}</h3>
      <p class="when">{formatWhen(event.start_time)}</p>
      {#if event.meet_link}
        <p class="link">
          <Video size={14} />
          <a href={event.meet_link} target="_blank" rel="noopener noreferrer">Meet link</a>
        </p>
      {/if}
    </div>
  </div>

  <div class="right">
    {#if event.has_bot}
      <span class="badge bot">
        <Bot size={14} /> Bot scheduled
      </span>
    {:else if event.meet_link}
      <button
        class="btn btn-primary"
        type="button"
        disabled={joining}
        on:click={() => onJoin(event)}
      >
        {joining ? 'Starting…' : 'Bot Auto-Join'}
      </button>
    {:else}
      <span class="badge muted">No Meet link</span>
    {/if}
  </div>
</div>

<style>
  .event {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1.1rem 1.25rem;
    margin-bottom: 0.75rem;
  }
  .left {
    display: flex;
    gap: 0.9rem;
    align-items: flex-start;
    min-width: 0;
  }
  .icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    flex-shrink: 0;
  }
  h3 {
    margin: 0 0 0.2rem;
    font-size: 1rem;
    font-weight: 600;
  }
  .when {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .link {
    margin: 0.35rem 0 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
  }
  .link a {
    color: var(--accent);
  }
  .right {
    flex-shrink: 0;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge.bot {
    background: #065f46;
    color: #34d399;
  }
  .badge.muted {
    background: var(--bg-muted);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  @media (max-width: 640px) {
    .event {
      flex-direction: column;
      align-items: stretch;
    }
    .right {
      width: 100%;
    }
    .right .btn {
      width: 100%;
    }
  }
</style>