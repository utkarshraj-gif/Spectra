<script lang="ts">
  import type { Meeting, MeetingSummary, ActionItem, TranscriptSegment } from '$lib/types';
  import {
    buildMarkdown,
    buildPlainText,
    downloadFile,
    copyToClipboard,
    exportPdfViaPrint
  } from '$lib/utils/exportNotes';
  import { toast } from '$lib/stores/toast';
  import { Download } from 'lucide-svelte';

  export let meeting: Meeting;
  export let summary: MeetingSummary | null = null;
  export let actionItems: ActionItem[] = [];
  export let segments: TranscriptSegment[] = [];

  let open = false;

  function slug(s: string) {
    return (s || 'meeting').replace(/[^\w\-]+/g, '_').slice(0, 40);
  }

  async function doCopySummary() {
    const text =
      summary?.executive_summary ||
      buildPlainText({ meeting, summary, actionItems, segments: [] });
    const ok = await copyToClipboard(text);
    toast[ok ? 'success' : 'error'](ok ? 'Summary copied' : 'Copy failed');
    open = false;
  }

  function doMarkdown() {
    const md = buildMarkdown({ meeting, summary, actionItems, segments });
    downloadFile(`${slug(meeting.title)}.md`, md, 'text/markdown;charset=utf-8');
    toast.success('Markdown downloaded');
    open = false;
  }

  function doPlain() {
    const txt = buildPlainText({ meeting, summary, actionItems, segments });
    downloadFile(`${slug(meeting.title)}.txt`, txt, 'text/plain;charset=utf-8');
    toast.success('Text downloaded');
    open = false;
  }

  function doPdf() {
    const txt = buildPlainText({ meeting, summary, actionItems, segments });
    exportPdfViaPrint(meeting.title || 'Meeting', txt);
    open = false;
  }
</script>

<div class="wrap">
  <button type="button" class="btn btn-outline" on:click={() => (open = !open)}>
    <Download size={16} />
    Export
  </button>

  {#if open}
    <div class="menu card">
      <button type="button" on:click={doCopySummary}>Copy Summary</button>
      <button type="button" on:click={doMarkdown}>Download Markdown</button>
      <button type="button" on:click={doPlain}>Download Plain Text</button>
      <button type="button" on:click={doPdf}>Export PDF (Print)</button>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    display: inline-block;
  }
  .wrap > .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    min-width: 200px;
    padding: 0.35rem;
    z-index: 20;
    display: flex;
    flex-direction: column;
  }
  .menu button {
    background: none;
    border: none;
    text-align: left;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    color: var(--text);
    cursor: pointer;
    font-size: 0.9rem;
  }
  .menu button:hover {
    background: var(--bg-muted);
  }
</style>