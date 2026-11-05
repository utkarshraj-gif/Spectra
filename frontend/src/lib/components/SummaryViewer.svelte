<script lang="ts">
  import type { MeetingSummary } from '$lib/types';

  export let summary: MeetingSummary | null = null;
  export let onJumpToTimestamp: (seconds: number) => void = () => {};

  function handleQuoteClick(text: string) {
    // Simple heuristic: if backend later provides timestamps on decisions, use them
    // For now this is a hook the parent can use
  }
</script>

{#if !summary}
  <div class="empty card">
    <p>No AI summary available yet.</p>
    <p class="muted">Summary appears after the meeting is processed.</p>
  </div>
{:else}
  <div class="summary">
    <section class="card block">
      <h3>Executive Summary</h3>
      <p class="body">{summary.executive_summary}</p>
    </section>

    {#if summary.key_decisions?.length}
      <section class="card block">
        <h3>Key Decisions</h3>
        <ul>
          {#each summary.key_decisions as decision}
            <li>
              <button class="quote" type="button" on:click={() => handleQuoteClick(decision)}>
                {decision}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if summary.topics?.length}
      <section class="card block">
        <h3>Topics</h3>
        <div class="tags">
          {#each summary.topics as topic}
            <span class="tag">{topic}</span>
          {/each}
        </div>
      </section>
    {/if}
  </div>
{/if}

<style>
  .empty {
    padding: 2rem;
    text-align: center;
  }
  .muted { color: var(--text-muted); font-size: 0.9rem; }
  .block { padding: 1.5rem; margin-bottom: 1rem; }
  h3 { margin: 0 0 0.75rem; font-size: 1.05rem; }
  .body { line-height: 1.6; color: var(--text); }
  ul { padding-left: 1.1rem; margin: 0; }
  li { margin-bottom: 0.5rem; }
  .quote {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    text-align: left;
    font-size: 0.95rem;
    padding: 0;
  }
  .quote:hover { text-decoration: underline; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .tag {
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
  }
</style>