<script lang="ts">
  import type { TranscriptSegment } from '$lib/types';

  export let segments: TranscriptSegment[] = [];

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
</script>

<div class="transcript">
  {#if segments.length === 0}
    <p class="empty">No transcript available yet.</p>
  {:else}
    {#each segments as seg}
      <div class="segment">
        <span class="time">{formatTime(seg.start_seconds)}</span>
        {#if seg.speaker_id}
          <span class="speaker">{seg.speaker_id}</span>
        {/if}
        <p class="text">{seg.text}</p>
      </div>
    {/each}
  {/if}
</div>

<style>
  .transcript {
    background: #0f172a;
    border-radius: 8px;
    padding: 1rem;
    max-height: 600px;
    overflow-y: auto;
  }
  .segment {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #1e293b;
  }
  .segment:last-child {
    border-bottom: none;
  }
  .time {
    font-size: 0.75rem;
    color: #60a5fa;
    font-family: monospace;
    margin-right: 0.5rem;
  }
  .speaker {
    font-size: 0.75rem;
    color: #a78bfa;
    font-weight: 600;
  }
  .text {
    margin: 0.25rem 0 0 0;
    line-height: 1.5;
    color: #e2e8f0;
  }
  .empty {
    color: #64748b;
    text-align: center;
    padding: 2rem;
  }
</style>