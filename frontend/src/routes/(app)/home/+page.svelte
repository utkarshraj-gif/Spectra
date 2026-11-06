<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { CalendarDays, Upload, Plus, ChevronRight, Play, CalendarCog, Sparkles, MessageCircle, Layers, Bot, Video } from 'lucide-svelte';
  import SpectraLogo from '$lib/components/brand/SpectraLogo.svelte';
  import WelcomeModal from '$lib/components/onboarding/WelcomeModal.svelte';
  import { onboarding, profile, firstName } from '$lib/stores/onboarding';
  import { toast } from '$lib/stores/toast';
  import { listMeetings, listCalendarEvents } from '$lib/api/client';
  import type { Meeting, CalendarEvent } from '$lib/types';

  type Tab = 'recent' | 'upcoming' | 'feed';

  let tab: Tab = 'recent';
  let meetings: Meeting[] = [];
  let events: CalendarEvent[] = [];
  let calendarConnected = false;
  let loading = true;
  let fileInput: HTMLInputElement;
  let showWelcome = !$onboarding.welcomeDone;

  const SAMPLE = {
    title: 'Spectra AI Platform Quick Overview',
    date: new Date('2024-08-08T15:52:00')
  };

  const tryMore = [
    { title: 'AskSpectra', desc: 'Ask anything across all your meetings.', href: '/ask', icon: MessageCircle, tint: '#b46cff' },
    { title: 'AI Skills', desc: 'Turn transcripts into notes, emails and docs.', href: '/ai-skills', icon: Sparkles, tint: '#f0508c' },
    { title: 'Integrations', desc: 'Send recaps to Slack, Notion, Jira and more.', href: '/integrations', icon: Layers, tint: '#4fb3ff' },
    { title: 'Voice Agents', desc: 'Let an AI agent run routine calls for you.', href: '/voice-agents', icon: Bot, tint: '#57e08a' }
  ];

  function formatDate(d: Date) {
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${date}, ${time}`;
  }

  onMount(async () => {
    const [m, c] = await Promise.allSettled([listMeetings(), listCalendarEvents()]);
    if (m.status === 'fulfilled') {
      meetings = [...m.value]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 5);
    }
    if (c.status === 'fulfilled' && c.value.ok) {
      events = c.value.events;
      calendarConnected = true;
    }
    loading = false;
  });

  function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) toast.info(`Uploading recordings is coming soon (${file.name}).`);
    (e.target as HTMLInputElement).value = '';
  }
</script>

<div class="home">
  <section class="welcome">
    <div class="welcome-text">
      <h1>Welcome Aboard, {firstName($profile.name)}!</h1>
      <p>Spectra is now ready to automate your meetings and streamline your workflows.</p>
    </div>
    <button class="thumb" on:click={() => toast.info('Product demo video is coming soon.')} aria-label="Play product demo">
      <span class="thumb-title"><SpectraLogo size={8} color="#fff" /> Spectra · Product Demo</span>
      <span class="play"><Play size={14} fill="#fff" /></span>
      <span class="presenter">M</span>
    </button>
  </section>

  <section>
    <h2>Quick Start</h2>
    <p class="muted">Capture your first meeting or upload a recording to see Spectra in action.</p>
    <div class="quick">
      <button class="qs pink" on:click={() => window.open('https://calendar.google.com/calendar/r/eventedit', '_blank')}>
        <CalendarDays size={15} /> <span>Schedule Meeting</span> <ChevronRight size={15} />
      </button>
      <button class="qs green" on:click={() => fileInput.click()}>
        <Upload size={15} /> <span>Upload File</span> <ChevronRight size={15} />
      </button>
      <button class="qs purple" on:click={() => goto('/meetings/new')}>
        <Plus size={15} /> <span>Capture Meeting</span> <ChevronRight size={15} />
      </button>
      <input type="file" accept="audio/*,video/*" hidden bind:this={fileInput} on:change={onFile} />
    </div>
  </section>

  <section>
    <div class="tabs-row">
      <div class="tabs" role="tablist">
        <button role="tab" class:active={tab === 'recent'} on:click={() => (tab = 'recent')}>Recent</button>
        <button role="tab" class:active={tab === 'upcoming'} on:click={() => (tab = 'upcoming')}>
          Upcoming{#if calendarConnected}&nbsp;·&nbsp;{events.length}{/if}
        </button>
        <button role="tab" class:active={tab === 'feed'} on:click={() => (tab = 'feed')}>AI Feed</button>
      </div>
      <a class="tab-settings" href="/settings"><CalendarCog size={14} /> Settings</a>
    </div>

    <div class="list">
      {#if tab === 'recent'}
        {#each meetings as m (m.id)}
          <a class="row" href="/meetings/{m.id}">
            <span class="row-icon"><Video size={15} color="#9013fe" /></span>
            <span class="row-text">
              <span class="row-title">{m.title || m.meeting_url}</span>
              <span class="row-date">{formatDate(new Date(m.created_at))}</span>
            </span>
          </a>
        {/each}
        <div class="row">
          <span class="row-icon"><SpectraLogo size={18} /></span>
          <span class="row-text">
            <span class="row-title">{SAMPLE.title}</span>
            <span class="row-date">{formatDate(SAMPLE.date)}</span>
          </span>
        </div>
      {:else if tab === 'upcoming'}
        {#if loading}
          <p class="empty">Loading calendar…</p>
        {:else if !calendarConnected}
          <div class="empty">
            <p>Connect your calendar so Spectra can join upcoming meetings automatically.</p>
            <a href="/settings" class="link-btn">Connect calendar</a>
          </div>
        {:else if events.length === 0}
          <p class="empty">No upcoming meetings with a video link.</p>
        {:else}
          {#each events as e (e.id)}
            <div class="row">
              <span class="row-icon"><CalendarDays size={15} color="#f0508c" /></span>
              <span class="row-text">
                <span class="row-title">{e.summary}</span>
                <span class="row-date">{e.start_time ? formatDate(new Date(e.start_time)) : 'Time TBD'}</span>
              </span>
              {#if e.has_bot}<span class="pill">Spectra joining</span>{/if}
            </div>
          {/each}
        {/if}
      {:else}
        <p class="empty">Highlights, decisions, and action items from your meetings will show up here once Spectra captures a few.</p>
      {/if}
    </div>
  </section>

  <section>
    <h2 class="try">Try More</h2>
    <div class="try-grid">
      {#each tryMore as t}
        <a class="try-card" href={t.href}>
          <span class="try-icon" style="color:{t.tint}"><svelte:component this={t.icon} size={16} /></span>
          <span class="try-title">{t.title}</span>
          <span class="try-desc">{t.desc}</span>
        </a>
      {/each}
    </div>
  </section>
</div>

{#if showWelcome}
  <WelcomeModal on:done={() => (showWelcome = false)} />
{/if}

<style>
  .home {
    max-width: 840px;
    margin: 18px auto 0;
    font-family: 'Inter', sans-serif;
  }
  section + section {
    margin-top: 40px;
  }

  .welcome {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 36px 112px 36px 112px;
    min-height: 210px;
    border-radius: 12px;
    border: 1px solid #6a4020;
    background:
      radial-gradient(500px 200px at 20% 100%, rgba(120, 60, 20, 0.35), transparent 70%),
      linear-gradient(90deg, #2c1a10 0%, #3a2214 55%, #2e1b10 100%);
  }
  .welcome-text h1 {
    font-size: 20px;
    font-weight: 600;
    color: #f5ece4;
  }
  .welcome-text p {
    margin-top: 12px;
    max-width: 260px;
    font-size: 13px;
    line-height: 1.55;
    color: #d6c7b8;
  }
  .thumb {
    position: relative;
    flex-shrink: 0;
    width: 200px;
    height: 132px;
    border-radius: 10px;
    border: 3px solid #f6d79a;
    background:
      radial-gradient(120px 60px at 50% 40%, rgba(190, 80, 255, 0.55), transparent 70%),
      linear-gradient(180deg, #5b1aa0, #2b0d4f 60%, #170825);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3), 0 10px 30px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }
  .thumb:hover .play {
    transform: translate(-50%, -50%) scale(1.06);
  }
  .thumb-title {
    position: absolute;
    top: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    font-size: 8.5px;
    color: rgba(255, 255, 255, 0.85);
  }
  .play {
    position: absolute;
    top: 45%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 28px;
    border-radius: 14px;
    background: #9013fe;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s;
  }
  .presenter {
    position: absolute;
    left: 8px;
    bottom: 8px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #fff;
    background: #6b5a4c;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h2 {
    font-size: 15.5px;
    font-weight: 600;
    color: #f0f0f0;
  }
  .muted {
    margin-top: 6px;
    color: #a6a6a6;
    font-size: 13px;
  }
  .quick {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .qs {
    height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 13.5px;
    color: #f0f0f0;
    text-align: left;
    transition: filter 0.15s;
  }
  .qs span {
    flex: 1;
  }
  .qs:hover {
    filter: brightness(1.15);
  }
  .qs.pink {
    background: #3a1022;
    border: 1px solid #5e1c38;
  }
  .qs.pink :global(svg:first-child) {
    color: #f0507f;
  }
  .qs.green {
    background: #0f2c25;
    border: 1px solid #1b4a3d;
  }
  .qs.green :global(svg:first-child) {
    color: #3fd39a;
  }
  .qs.purple {
    background: #261342;
    border: 1px solid #3f2170;
  }
  .qs.purple :global(svg:first-child) {
    color: #b46cff;
  }

  .tabs-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tabs {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 6px;
    background: #222;
    border: 1px solid #2c2c2c;
  }
  .tabs button {
    height: 26px;
    padding: 0 10px;
    border: none;
    border-radius: 4px;
    background: none;
    color: #b5b5b5;
    font-family: inherit;
    font-size: 12.5px;
  }
  .tabs button:hover {
    color: #fff;
  }
  .tabs button.active {
    background: #3a3a3a;
    color: #fff;
  }
  .tab-settings {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #cfcfcf;
  }
  .tab-settings:hover {
    color: #fff;
  }

  .list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 10px;
    border-radius: 6px;
  }
  a.row:hover {
    background: #1f1f1f;
  }
  .row-icon {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 5px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .row-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .row-title {
    font-size: 13px;
    font-weight: 500;
    color: #f0f0f0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-date {
    font-size: 12px;
    color: #9a9a9a;
  }
  .pill {
    margin-left: auto;
    font-size: 11px;
    color: #c895ff;
    background: #2a1645;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .empty {
    padding: 22px 10px;
    color: #9a9a9a;
    font-size: 13px;
    line-height: 1.5;
  }
  .empty p {
    margin-bottom: 12px;
  }
  .link-btn {
    display: inline-flex;
    height: 30px;
    align-items: center;
    padding: 0 12px;
    border-radius: 5px;
    background: #9013fe;
    color: #fff;
    font-size: 12.5px;
  }

  .try {
    margin-top: 16px;
  }
  .try-grid {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .try-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border-radius: 8px;
    border: 1px solid #2a2a2a;
    background: #1b1b1b;
  }
  .try-card:hover {
    border-color: #3a3a3a;
    background: #1f1f1f;
  }
  .try-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: #262626;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }
  .try-title {
    font-size: 13px;
    font-weight: 500;
    color: #f0f0f0;
  }
  .try-desc {
    font-size: 12px;
    color: #9a9a9a;
    line-height: 1.45;
  }

  @media (max-width: 900px) {
    .welcome {
      padding: 28px;
    }
    .try-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 640px) {
    .welcome {
      flex-direction: column;
      align-items: flex-start;
    }
    .quick {
      grid-template-columns: 1fr;
    }
  }
</style>
