<script lang="ts">
  import { tick, afterUpdate } from 'svelte';
  import type { TranscriptSegment } from '$lib/types';

  export let segments: TranscriptSegment[] = [];

  let scrollContainer: HTMLElement;
  let copied = false;

  interface ConversationTurn {
    id: string;
    speaker: string;
    speakerInitials: string;
    color: { bg: string; text: string; border: string; accent: string; avatarBg: string };
    startTimeMs: number;
    endTimeMs: number;
    text: string;
  }

  const SPEAKER_PALETTES = [
    { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', accent: '#2563eb', avatarBg: '#2563eb' }, // Blue
    { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe', accent: '#7c3aed', avatarBg: '#7c3aed' }, // Purple
    { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', accent: '#16a34a', avatarBg: '#16a34a' }, // Emerald
    { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa', accent: '#ea580c', avatarBg: '#ea580c' }, // Orange
    { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8', accent: '#db2777', avatarBg: '#db2777' }, // Pink
    { bg: '#ecfeff', text: '#155e75', border: '#a5f3fc', accent: '#0891b2', avatarBg: '#0891b2' }, // Cyan
    { bg: '#fefce8', text: '#854d0e', border: '#fef08a', accent: '#ca8a04', avatarBg: '#ca8a04' }, // Amber
  ];

  function getSpeakerColor(name: string) {
    if (!name) return SPEAKER_PALETTES[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % SPEAKER_PALETTES.length;
    return SPEAKER_PALETTES[idx];
  }

  function getInitials(name: string): string {
    if (!name) return '?';
    const cleaned = name.replace(/[^\w\s]/g, '').trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (cleaned.slice(0, 2) || '?').toUpperCase();
  }

  function formatTime(ms: number): string {
    const sec = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Reactively group granular transcript segments into conversational dialogue turns
  $: turns = groupTurns(segments);

  function groupTurns(rawList: TranscriptSegment[]): ConversationTurn[] {
    if (!rawList || rawList.length === 0) return [];

    const valid = rawList.filter((s) => s && s.text && s.text.trim().length > 0);
    if (valid.length === 0) return [];

    const result: ConversationTurn[] = [];
    let current: ConversationTurn | null = null;

    for (const seg of valid) {
      const speakerName = (seg.speaker || seg.speaker_id || 'Speaker').trim();
      const rawStart = Number(seg.start_time_ms ?? (seg.start_seconds ? seg.start_seconds * 1000 : 0)) || 0;
      const rawEnd = Number(seg.end_time_ms ?? (seg.end_seconds ? seg.end_seconds * 1000 : rawStart + 2000)) || (rawStart + 2000);
      const text = seg.text.trim();

      // Check if this segment belongs to the active turn:
      // Same speaker AND natural speech pause between utterances is <= 8 seconds
      const isSameSpeaker = current && current.speaker.toLowerCase() === speakerName.toLowerCase();
      const isWithinPauseLimit = current && rawStart - current.endTimeMs <= 8000;

      if (current && isSameSpeaker && isWithinPauseLimit) {
        // Append sentence text if not already included
        if (!current.text.includes(text)) {
          const endsWithPunct = /[.!?]$/.test(current.text);
          current.text = endsWithPunct ? `${current.text} ${text}` : `${current.text}. ${text}`;
        }
        current.endTimeMs = Math.max(current.endTimeMs, rawEnd);
      } else {
        current = {
          id: seg.id || `turn-${result.length}-${rawStart}`,
          speaker: speakerName,
          speakerInitials: getInitials(speakerName),
          color: getSpeakerColor(speakerName),
          startTimeMs: rawStart,
          endTimeMs: rawEnd,
          text: text,
        };
        result.push(current);
      }
    }

    return result;
  }

  afterUpdate(() => {
    if (scrollContainer) {
      const threshold = 150;
      const isNearBottom =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < threshold;
      if (isNearBottom) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  });

  async function copyTranscript() {
    if (turns.length === 0) return;
    const textLines = turns.map(
      (t) => `[${formatTime(t.startTimeMs)}] ${t.speaker}:\n${t.text}\n`
    );
    try {
      await navigator.clipboard.writeText(textLines.join('\n'));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {}
  }
</script>

<div class="transcript-wrapper">
  {#if turns.length > 0}
    <div class="transcript-header">
      <span class="turn-count">{turns.length} conversational {turns.length === 1 ? 'turn' : 'turns'}</span>
      <button class="btn-copy" on:click={copyTranscript} title="Copy full conversational dialogue">
        {copied ? '✓ Copied!' : 'Copy Transcript'}
      </button>
    </div>
  {/if}

  <div class="transcript-scroll" bind:this={scrollContainer}>
    {#if turns.length === 0}
      <div class="empty-state">
        <div class="empty-icon">🎙️</div>
        <p class="empty-title">Waiting for speech...</p>
        <p class="empty-desc">When meeting participants speak, the conversational dialogue will appear here live.</p>
      </div>
    {:else}
      {#each turns as turn (turn.id)}
        <div class="turn-card" style="border-left-color: {turn.color.accent};">
          <div class="turn-meta">
            <div class="avatar" style="background-color: {turn.color.avatarBg};">
              {turn.speakerInitials}
            </div>
            <div class="speaker-info">
              <span class="speaker-name">{turn.speaker}</span>
              <span class="time-pill">{formatTime(turn.startTimeMs)}</span>
            </div>
          </div>
          <div class="turn-body">
            <p class="turn-text">{turn.text}</p>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .transcript-wrapper {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .transcript-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.65rem 1.25rem;
    border-bottom: 1px solid #f1f5f9;
    background: #f8fafc;
  }

  .turn-count {
    font-size: 0.8rem;
    font-weight: 500;
    color: #64748b;
  }

  .btn-copy {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #334155;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-copy:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }

  .transcript-scroll {
    padding: 1.25rem;
    max-height: 580px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    scroll-behavior: smooth;
  }

  .turn-card {
    background: #ffffff;
    border: 1px solid #f1f5f9;
    border-left: 4px solid #2563eb;
    border-radius: 8px;
    padding: 0.875rem 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    transition: box-shadow 0.15s ease;
  }

  .turn-card:hover {
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.06);
  }

  .turn-meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.5rem;
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .speaker-info {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .speaker-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #0f172a;
  }

  .time-pill {
    font-size: 0.7rem;
    color: #64748b;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    background: #f1f5f9;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .turn-body {
    padding-left: 2.35rem;
  }

  .turn-text {
    margin: 0;
    color: #1e293b;
    font-size: 0.925rem;
    line-height: 1.6;
    word-break: break-word;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: #64748b;
  }

  .empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .empty-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #334155;
    margin: 0 0 0.25rem 0;
  }

  .empty-desc {
    font-size: 0.825rem;
    color: #64748b;
    margin: 0;
  }
</style>
