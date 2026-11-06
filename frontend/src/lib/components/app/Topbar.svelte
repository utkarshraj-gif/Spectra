<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Search, Bell, Video, ChevronDown, PanelLeft, Upload, CalendarPlus, Link } from 'lucide-svelte';
  import { titleForPath } from './nav';
  import { FREE_MEETINGS_LEFT } from './plan';
  import { toast } from '$lib/stores/toast';

  const dispatch = createEventDispatcher<{ toggleSidebar: void }>();

  let query = '';
  let searchEl: HTMLInputElement;
  let captureOpen = false;
  let captureRoot: HTMLElement;
  let fileInput: HTMLInputElement;

  $: title = titleForPath($page.url.pathname);

  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchEl?.focus();
    }
    if (e.key === 'Escape') captureOpen = false;
  }

  function onWindowClick(e: MouseEvent) {
    if (captureOpen && captureRoot && !captureRoot.contains(e.target as Node)) captureOpen = false;
  }

  function submitSearch() {
    const q = query.trim();
    goto(q ? `/dashboard?q=${encodeURIComponent(q)}` : '/dashboard');
  }

  function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) toast.info(`Uploading recordings is coming soon (${file.name}).`);
    (e.target as HTMLInputElement).value = '';
  }

  function pick(action: 'live' | 'upload' | 'schedule') {
    captureOpen = false;
    if (action === 'live') goto('/meetings/new');
    if (action === 'upload') fileInput.click();
    if (action === 'schedule') window.open('https://calendar.google.com/calendar/r/eventedit', '_blank');
  }
</script>

<svelte:window on:keydown={onKey} on:click={onWindowClick} />

<header class="topbar">
  <div class="left">
    <button class="ghost" aria-label="Toggle sidebar" on:click={() => dispatch('toggleSidebar')}>
      <PanelLeft size={15} />
    </button>
    <span class="title">{title}</span>
  </div>

  <form class="search" on:submit|preventDefault={submitSearch}>
    <Search size={14} />
    <input bind:this={searchEl} bind:value={query} placeholder="Search by title or keyword" />
    <kbd>Ctrl + K</kbd>
  </form>

  <div class="right">
    <span class="free"><span class="num">{FREE_MEETINGS_LEFT}</span> Free meetings</span>
    <a class="upgrade" href="/upgrade">Upgrade</a>
    <a class="bell" href="/notifications" aria-label="Notifications">
      <Bell size={17} />
      <span class="badge" />
    </a>
    <div class="capture" bind:this={captureRoot}>
      <button class="cap-main" on:click={() => pick('live')}>
        <Video size={15} /> Capture
      </button>
      <button class="cap-more" aria-label="More capture options" on:click|stopPropagation={() => (captureOpen = !captureOpen)}>
        <ChevronDown size={14} />
      </button>
      {#if captureOpen}
        <div class="cap-menu">
          <button on:click={() => pick('live')}><Link size={14} /> Capture live meeting</button>
          <button on:click={() => pick('upload')}><Upload size={14} /> Upload audio or video</button>
          <button on:click={() => pick('schedule')}><CalendarPlus size={14} /> Schedule meeting</button>
        </div>
      {/if}
      <input type="file" accept="audio/*,video/*" hidden bind:this={fileInput} on:change={onFile} />
    </div>
  </div>
</header>

<style>
  .topbar {
    height: 46px;
    flex-shrink: 0;
    display: grid;
    grid-template-columns: 1fr minmax(220px, 300px) 1fr;
    align-items: center;
    gap: 12px;
    padding: 0 12px 0 8px;
    border-bottom: 1px solid #262626;
    background: #1a1a1a;
    position: sticky;
    top: 0;
    z-index: 40;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .ghost {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: #7d7d7d;
    border-radius: 5px;
  }
  .ghost:hover {
    background: #262626;
    color: #e6e6e6;
  }
  .title {
    font-size: 13.5px;
    color: #e6e6e6;
    white-space: nowrap;
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 8px 0 10px;
    border: 1px solid #2e2e2e;
    border-radius: 6px;
    background: #1e1e1e;
    color: #8a8a8a;
  }
  .search:focus-within {
    border-color: #4a4a4a;
  }
  .search input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    color: #eaeaea;
    font-size: 13px;
    font-family: inherit;
  }
  .search input::placeholder {
    color: #8a8a8a;
  }
  kbd {
    font-family: inherit;
    font-size: 11px;
    color: #8a8a8a;
    white-space: nowrap;
  }

  .right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }
  .free {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #d6d6d6;
    white-space: nowrap;
  }
  .num {
    background: #1d4a2c;
    color: #6ee79a;
    font-weight: 600;
    font-size: 11px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .upgrade {
    height: 28px;
    padding: 0 9px;
    display: flex;
    align-items: center;
    border-radius: 5px;
    background: #1a3a26;
    border: 1px solid #245c36;
    color: #6ee79a;
    font-size: 13px;
    font-weight: 500;
  }
  .upgrade:hover {
    background: #1f452d;
  }
  .bell {
    position: relative;
    width: 32px;
    height: 32px;
    margin-left: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cfcfcf;
    border-radius: 6px;
  }
  .bell:hover {
    background: #262626;
  }
  .badge {
    position: absolute;
    top: 5px;
    right: 6px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f43f5e;
  }

  .capture {
    position: relative;
    display: flex;
    height: 30px;
    border-radius: 6px;
    background: #9013fe;
  }
  .capture button {
    background: none;
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
  }
  .cap-main {
    gap: 6px;
    padding: 0 10px;
    font-size: 13.5px;
    font-weight: 500;
    border-right: 1px solid rgba(255, 255, 255, 0.25) !important;
  }
  .cap-more {
    padding: 0 8px;
  }
  .capture > button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .cap-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 220px;
    padding: 4px;
    background: #1e1e1e;
    border: 1px solid #2e2e2e;
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    z-index: 50;
  }
  .cap-menu button {
    width: 100%;
    gap: 8px;
    padding: 8px 10px;
    font-size: 13px;
    color: #e6e6e6;
    border-radius: 5px;
  }
  .cap-menu button:hover {
    background: #2a2a2a;
  }

  @media (max-width: 980px) {
    .topbar {
      grid-template-columns: auto 1fr auto;
    }
    .free,
    .bell {
      display: none;
    }
  }
  @media (max-width: 640px) {
    .search,
    .upgrade {
      display: none;
    }
  }
</style>
