<script lang="ts">
  import type { ParticipantStats } from '$lib/types';

  export let participants: ParticipantStats[] = [];

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s}s`;
  }

  $: total = participants.reduce((a, p) => a + p.speak_time_seconds, 0) || 1;
</script>

{#if participants.length === 0}
  <div class="empty card"><p>No participant data yet.</p></div>
{:else}
  <div class="list">
    {#each participants as p}
      <div class="card row">
        <div class="info">
          <strong>{p.name}</strong>
          {#if p.email}<span class="email">{p.email}</span>{/if}
        </div>
        <div class="stats">
          <span>{formatTime(p.speak_time_seconds)}</span>
          <span>{p.segment_count} segments</span>
        </div>
        <div class="bar">
          <div class="fill" style="width: {(p.speak_time_seconds / total) * 100}%" />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty { padding: 2rem; text-align: center; color: var(--text-muted); }
  .list { display: flex; flex-direction: column; gap: 0.75rem; }
  .row { padding: 1rem 1.25rem; }
  .info { display: flex; gap: 0.75rem; align-items: baseline; margin-bottom: 0.35rem; }
  .email { color: var(--text-muted); font-size: 0.85rem; }
  .stats { display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
  .bar {
    height: 6px;
    background: var(--bg-muted);
    border-radius: 999px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--accent);
    border-radius: 999px;
  }
</style>