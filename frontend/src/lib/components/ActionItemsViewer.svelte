<script lang="ts">
  import type { ActionItem } from '$lib/types';

  export let items: ActionItem[] = [];
  export let onToggle: (item: ActionItem) => void = () => {};
  export let onJump: (seconds: number) => void = () => {};

  function cycleStatus(item: ActionItem) {
    const order = ['open', 'in_progress', 'done'] as const;
    const idx = order.indexOf(item.status);
    const next = order[(idx + 1) % order.length];
    onToggle({ ...item, status: next });
  }

  function handleJump(item: ActionItem) {
    if (item.source_timestamp != null) {
      onJump(item.source_timestamp);
    }
  }

  function formatTs(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function jumpToSource(item: ActionItem) {
  if (item.source_timestamp != null) {
    onJump(item.source_timestamp);
  }
}
</script>

{#if items.length === 0}
  <div class="empty card">
    <p>No action items extracted yet.</p>
  </div>
{:else}
  <div class="list">
    {#each items as item}
      <div class="card item" class:done={item.status === 'done'}>
        <button class="check" type="button" on:click={() => cycleStatus(item)} title="Toggle status">
          {#if item.status === 'done'}✓{:else if item.status === 'in_progress'}◐{:else}○{/if}
        </button>
        <div class="content">
          <p class="text">{item.text}</p>
          <div class="meta">
            {#if item.assignee}<span>@{item.assignee}</span>{/if}
            {#if item.due_date}<span>Due {new Date(item.due_date).toLocaleDateString()}</span>{/if}
            {#if item.source_timestamp != null}
              <button
                class="ts"
                type="button"
                on:click={() => {
                  if (item.source_timestamp != null) {
                    onJump(item.source_timestamp);
                  }
                }}
              >
                {Math.floor(item.source_timestamp / 60)}:{String(Math.floor(item.source_timestamp % 60)).padStart(2, '0')}
              </button>
            {/if}
            <span class="badge {item.status}">{item.status.replace('_', ' ')}</span>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .empty {
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .item {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    align-items: flex-start;
  }
  .item.done .text {
    text-decoration: line-through;
    opacity: 0.65;
  }
  .check {
    background: none;
    border: 1px solid var(--border);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    flex-shrink: 0;
    color: var(--text);
  }
  .text {
    margin: 0 0 0.35rem;
    line-height: 1.45;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    align-items: center;
  }
  .ts {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-family: monospace;
    padding: 0;
  }
  .badge {
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  .badge.open {
    background: #334155;
    color: #cbd5e1;
  }
  .badge.in_progress {
    background: #854d0e;
    color: #fde047;
  }
  .badge.done {
    background: #065f46;
    color: #34d399;
  }
</style>