<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { Zap, Monitor, Smartphone, ArrowRight } from 'lucide-svelte';
  import BrandIcon from '$lib/components/brand/BrandIcon.svelte';
  import SpectraLogo from '$lib/components/brand/SpectraLogo.svelte';
  import { profile, firstName } from '$lib/stores/onboarding';
  import { toast } from '$lib/stores/toast';
  import { FREE_MEETINGS_LEFT, FREE_MEETINGS_TOTAL, STORAGE_USED_MIN, STORAGE_TOTAL_MIN } from './plan';

  const dispatch = createEventDispatcher<{ close: void }>();

  const links: { label: string; href: string }[] = [
    { label: 'Playlist', href: '/playlist' },
    { label: 'Settings', href: '/settings' },
    { label: 'My team', href: '/team' },
    { label: 'Manage web logins', href: '/web-logins' },
    { label: 'Platform rules', href: '/platform-rules' }
  ];

  function go(href: string) {
    dispatch('close');
    goto(href);
  }

  function logout() {
    localStorage.removeItem('token');
    dispatch('close');
    goto('/login');
  }

  function download(platform: string) {
    toast.info(`Spectra for ${platform} is coming soon.`);
  }
</script>

<div class="menu" role="menu">
  <div class="panel account">
    <div class="hello">
      <div class="hi">Hi {firstName($profile.name)}</div>
      <div class="email">{$profile.email}</div>
    </div>

    <div class="sep" />

    <div class="plan">
      <div class="label">Free</div>
      <div class="bar"><span style="width:{(FREE_MEETINGS_LEFT / FREE_MEETINGS_TOTAL) * 100}%" /></div>
      <div class="meta">{FREE_MEETINGS_LEFT} left / {FREE_MEETINGS_TOTAL} free meetings</div>
      <button class="upgrade" on:click={() => go('/upgrade')}>
        <Zap size={14} fill="currentColor" /> Upgrade
      </button>
    </div>

    <div class="plan">
      <div class="label">Storage</div>
      <div class="bar"><span style="width:{(STORAGE_USED_MIN / STORAGE_TOTAL_MIN) * 100}%" /></div>
      <div class="meta">{STORAGE_USED_MIN} / {STORAGE_TOTAL_MIN} mins</div>
    </div>

    <div class="sep" />
    <button class="item" on:click={() => go('/refer')}>Refer and earn $5</button>
    <div class="sep" />

    {#each links as l}
      <button class="item" on:click={() => go(l.href)}>{l.label}</button>
    {/each}
    <button class="item theme" on:click={() => toast.info('Light theme is coming soon.')}>
      <span>Theme <span class="beta">BETA</span></span>
      <span class="muted">Dark</span>
    </button>
    <button class="item" on:click={logout}>Logout</button>
  </div>

  <div class="panel apps">
    <div class="app-card">
      <div class="app-title"><Monitor size={16} color="#8ab4f8" /> Desktop App</div>
      <p>Record meetings without a bot and dictate anywhere with Spectra Talk.</p>
      <div class="app-actions">
        <button class="icon-btn" title="Download for Windows" on:click={() => download('Windows')}>
          <BrandIcon name="windows" size={13} />
        </button>
        <button class="icon-btn" title="Download for macOS" on:click={() => download('macOS')}>
          <BrandIcon name="apple" size={14} />
        </button>
      </div>
    </div>

    <div class="app-card">
      <div class="app-title"><Smartphone size={16} color="#f0508c" /> Mobile App</div>
      <p>Transcribe and summarize in-person conversations with mobile app.</p>
      <div class="app-actions">
        <button class="icon-btn bare" title="App Store" on:click={() => download('iOS')}>
          <BrandIcon name="appstore" size={20} />
        </button>
        <button class="icon-btn bare" title="Google Play" on:click={() => download('Android')}>
          <BrandIcon name="googleplay" size={20} />
        </button>
      </div>
    </div>

    <div class="app-card">
      <div class="app-title"><BrandIcon name="chrome" size={16} /> Chrome Extension</div>
      <p>Record and transcribe Google Meet calls without Spectra notetaker bot.</p>
      <div class="app-actions">
        <button class="install" on:click={() => download('Chrome')}>Install</button>
      </div>
    </div>

    <button class="download" on:click={() => download('Desktop')}>
      <span class="dl-logo"><SpectraLogo size={14} /></span>
      <span>Download Spectra Desktop App</span>
      <ArrowRight size={15} />
    </button>
  </div>
</div>

<style>
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 10px;
    z-index: 100;
    display: flex;
    gap: 6px;
    padding: 6px;
    background: #141414;
    border: 1px solid #2a2a2a;
    border-radius: 10px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
    font-size: 13px;
  }
  .panel {
    background: #1b1b1b;
    border: 1px solid #262626;
    border-radius: 8px;
  }
  .account {
    width: 262px;
    padding: 10px 0 8px;
    display: flex;
    flex-direction: column;
  }
  .hello {
    padding: 6px 16px 10px;
  }
  .hi {
    font-size: 15px;
    font-weight: 500;
    color: #f2f2f2;
  }
  .email {
    color: #8d8d8d;
    font-size: 12px;
    margin-top: 3px;
  }
  .sep {
    height: 1px;
    background: #2a2a2a;
    margin: 6px 0;
  }
  .plan {
    padding: 8px 16px 10px;
  }
  .label {
    color: #e6e6e6;
    margin-bottom: 10px;
  }
  .bar {
    height: 3px;
    background: #2c2c2c;
    border-radius: 3px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: #22a34a;
  }
  .meta {
    color: #8d8d8d;
    font-size: 12px;
    margin-top: 8px;
  }
  .upgrade {
    width: 100%;
    margin-top: 10px;
    height: 34px;
    border-radius: 6px;
    border: 1px solid #245c36;
    background: #1a3a26;
    color: #6ee79a;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .upgrade:hover {
    background: #1f452d;
  }
  .item {
    background: none;
    border: none;
    color: #e6e6e6;
    font-size: 13px;
    text-align: left;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .item:hover {
    background: #242424;
  }
  .beta {
    font-size: 10px;
    font-weight: 600;
    background: #3d1a66;
    color: #c99cff;
    padding: 2px 5px;
    border-radius: 4px;
    margin-left: 6px;
  }
  .muted {
    color: #8d8d8d;
  }

  .apps {
    width: 296px;
    padding: 6px;
    background: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .app-card {
    background: #1e1e1e;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    padding: 12px 14px;
  }
  .app-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #f0f0f0;
    font-weight: 500;
    font-size: 13.5px;
  }
  .app-card p {
    color: #a3a3a3;
    font-size: 12.5px;
    line-height: 1.45;
    margin-top: 7px;
  }
  .app-actions {
    display: flex;
    gap: 6px;
    margin-top: 12px;
  }
  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 5px;
    background: #2a2a2a;
    border: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-btn.bare {
    background: none;
    border: none;
  }
  .icon-btn:hover {
    filter: brightness(1.2);
  }
  .install {
    height: 28px;
    padding: 0 10px;
    background: #2a2a2a;
    border: 1px solid #333;
    color: #e6e6e6;
    border-radius: 5px;
    font-size: 12.5px;
  }
  .install:hover {
    background: #333;
  }
  .download {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #2a1540;
    border: 1px solid #55307e;
    color: #f2f2f2;
    border-radius: 8px;
    font-size: 12.5px;
    text-align: left;
  }
  .download span:nth-child(2) {
    flex: 1;
  }
  .download:hover {
    background: #33194f;
  }
  .dl-logo {
    width: 26px;
    height: 26px;
    border-radius: 5px;
    background: #4a2470;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 700px) {
    .menu {
      flex-direction: column;
      max-height: 80vh;
      overflow: auto;
    }
  }
</style>
