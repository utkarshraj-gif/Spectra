<script lang="ts">
  import type { TranscriptSegment } from '$lib/types';

  export let segments: TranscriptSegment[] = [];

  function formatTime(seconds?: number, ms?: number) {
    let sec = 0;
    if (typeof ms === 'number' && !isNaN(ms)) {
      sec = ms / 1000;
    } else if (typeof seconds === 'number' && !isNaN(seconds)) {
      sec = seconds;
    }
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div class="transcript">
  {#if segments.length === 0}
    <p class="empty">No transcript available yet.</p>
  {:else}
    {#each segments as seg}
      <div class="segment">
        <span class="time">{formatTime(seg.start_seconds, seg.start_time_ms)}</span>
        {#if seg.speaker || seg.speaker_id}
          <span class="speaker">{seg.speaker || seg.speaker_id}</span>
        {/if}
        <p class="text">{seg.text}</p>
      </div>
    {/each}
  {/if}
</div>

<style>
  .transcript {
    background: var(--bg-muted, #f8fafc);
    border: 1px solid var(--border, #e2e2e8);
    border-radius: 8px;
    padding: 1.25rem;
    max-height: 600px;
    overflow-y: auto;
  }
  .segment {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border, #e2e2e8);
  }
  .segment:last-child {
    border-bottom: none;
  }
  .time {
    font-size: 0.75rem;
    color: #2563eb;
    font-family: monospace;
    font-weight: 600;
    margin-right: 0.5rem;
  }
  .speaker {
    font-size: 0.75rem;
    color: #7c3aed;
    font-weight: 700;
    margin-right: 0.5rem;
  }
  .text {
    margin: 0.35rem 0 0 0;
    line-height: 1.5;
    color: var(--text, #131316);
    font-size: 0.95rem;
  }
  .empty {
    color: var(--text-muted, #64748b);
    text-align: center;
    padding: 2.5rem;
  }
</style>
