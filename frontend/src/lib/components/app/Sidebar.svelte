<script lang="ts">
  import { page } from '$app/stores';
  import { ChevronDown, ArrowRight, X, UserPlus } from 'lucide-svelte';
  import BrandIcon from '$lib/components/brand/BrandIcon.svelte';
  import UserMenu from './UserMenu.svelte';
  import { NAV_GROUPS, BOTTOM_NAV } from './nav';
  import { onboarding, profile, firstName, avatarInitials, TEAM_PREVIEW } from '$lib/stores/onboarding';
  import { toast } from '$lib/stores/toast';

  export let collapsed = false;

  let menuOpen = false;
  let promoDismissed = false;
  let promoSlide = 0;
  let root: HTMLElement;

  $: path = $page.url.pathname;
  $: showPromo = !collapsed && !promoDismissed && $onboarding.team !== 'joined';
  $: teamOwner = TEAM_PREVIEW.members[0];
  $: teamCount = TEAM_PREVIEW.members.length + TEAM_PREVIEW.others;

  function isActive(href: string) {
    return path === href || (href !== '/home' && path.startsWith(href + '/'));
  }

  function onWindowClick(e: MouseEvent) {
    if (menuOpen && root && !root.contains(e.target as Node)) menuOpen = false;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') menuOpen = false;
  }

  function joinTeam() {
    onboarding.patch({ team: 'joined' });
    toast.success(`You joined ${teamOwner}'s team`);
  }
</script>

<svelte:window on:click={onWindowClick} on:keydown={onKey} />

<aside class="sidebar" class:collapsed bind:this={root}>
  <div class="head">
    <button class="account" on:click|stopPropagation={() => (menuOpen = !menuOpen)} aria-expanded={menuOpen}>
      <span class="avatar">{avatarInitials($profile)}</span>
      {#if !collapsed}
        <span class="name">{firstName($profile.name)}</span>
        <span class="chev" class:open={menuOpen}><ChevronDown size={13} /></span>
      {/if}
    </button>
    {#if menuOpen}
      <UserMenu on:close={() => (menuOpen = false)} />
    {/if}
  </div>

  <nav class="nav">
    {#each NAV_GROUPS as group, gi}
      {#if gi > 0}<div class="divider" />{/if}
      {#each group as item}
        <a href={item.href} class="link" class:active={isActive(item.href)} title={collapsed ? item.label : undefined}>
          {#if item.special === 'ask'}
            <span class="ask-icon" />
          {:else}
            <span class="icon-wrap">
              <svelte:component this={item.icon} size={16} strokeWidth={1.75} />
              {#if item.special === 'upgrade' && collapsed}<span class="spark" />{/if}
            </span>
          {/if}
          {#if !collapsed}
            <span class="label">{item.label}</span>
            {#if item.special === 'upgrade'}<span class="off">40% OFF</span>{/if}
          {/if}
        </a>
      {/each}
    {/each}
  </nav>

  <div class="bottom">
    {#if !collapsed}
      <button class="desktop" on:click={() => toast.info('Spectra for Windows is coming soon.')}>
        <BrandIcon name="windows" size={13} />
        <span>Get Desktop App</span>
        <ArrowRight size={14} />
      </button>
    {:else}
      <button class="link icon-only" title="Join team" on:click={joinTeam}>
        <span class="icon-wrap"><UserPlus size={16} strokeWidth={1.75} /></span>
      </button>
    {/if}

    {#each BOTTOM_NAV as item}
      <a href={item.href} class="link" class:active={isActive(item.href)} title={collapsed ? item.label : undefined}>
        <span class="icon-wrap"><svelte:component this={item.icon} size={16} strokeWidth={1.75} /></span>
        {#if !collapsed}<span class="label">{item.label}</span>{/if}
      </a>
    {/each}

    {#if showPromo}
      <div class="promo">
        <button class="promo-close" aria-label="Dismiss" on:click={() => (promoDismissed = true)}>
          <X size={13} />
        </button>
        <div class="promo-top">
          <span class="promo-avatar">{teamOwner[0]}</span>
          <span class="promo-count">+{teamCount}</span>
        </div>
        {#if promoSlide === 0}
          <p class="promo-text">{teamOwner}'s Team is on Spectra</p>
          <button class="promo-btn" on:click={joinTeam}>Join Team</button>
        {:else}
          <p class="promo-text">Invite teammates to share meetings</p>
          <a class="promo-btn" href="/team">Invite</a>
        {/if}
      </div>
      <div class="dots">
        {#each [0, 1] as i}
          <button class="dot" class:on={promoSlide === i} aria-label="Slide {i + 1}" on:click={() => (promoSlide = i)} />
        {/each}
      </div>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    width: 224px;
    flex-shrink: 0;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    background: #1a1a1a;
    border-right: 1px solid #262626;
    transition: width 0.18s ease;
  }
  .sidebar.collapsed {
    width: 52px;
  }

  .head {
    position: relative;
    padding: 10px 8px 6px;
  }
  .account {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #ececec;
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
  }
  .account:hover {
    background: #242424;
  }
  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    background: #c8213a;
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .chev {
    display: flex;
    color: #9a9a9a;
    transition: transform 0.15s;
  }
  .chev.open {
    transform: rotate(180deg);
  }

  .nav {
    padding: 4px 8px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
  }
  .divider {
    height: 1px;
    background: #262626;
    margin: 6px 4px;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 32px;
    padding: 0 8px;
    border-radius: 6px;
    color: #c9c9c9;
    font-size: 13.5px;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
  }
  .link:hover {
    background: #232323;
    color: #f2f2f2;
  }
  .link.active {
    background: #2a2a2a;
    color: #fff;
  }
  .collapsed .link {
    justify-content: center;
    padding: 0;
  }
  .icon-wrap {
    position: relative;
    display: flex;
    color: inherit;
  }
  .label {
    flex: 1;
    white-space: nowrap;
  }
  .ask-icon {
    width: 16px;
    height: 13px;
    border-radius: 8px 8px 3px 3px;
    background: linear-gradient(160deg, #c86bff 0%, #8b2cf5 55%, #ff5fa2 100%);
    box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.18);
    flex-shrink: 0;
  }
  .off {
    font-size: 10.5px;
    font-weight: 600;
    color: #57e08a;
    background: #173823;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .spark {
    position: absolute;
    top: -2px;
    right: -3px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #3ee07f;
  }

  .bottom {
    margin-top: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .desktop {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 10px;
    margin-bottom: 6px;
    border-radius: 6px;
    border: 1px solid #262640;
    background: #191a2e;
    color: #f0f0f0;
    font-size: 13px;
    font-weight: 500;
  }
  .desktop span {
    flex: 1;
    text-align: left;
  }
  .desktop:hover {
    background: #20223a;
  }

  .promo {
    position: relative;
    margin-top: 8px;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #2a2a2a;
    background: #1e1e1e;
  }
  .promo-close {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #7a7a7a;
    display: flex;
  }
  .promo-close:hover {
    color: #ddd;
  }
  .promo-top {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .promo-avatar {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: linear-gradient(135deg, #e8c6a8, #a87f63);
    color: #3b2a20;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .promo-count {
    font-size: 10.5px;
    font-weight: 700;
    color: #fff;
    background: #e0177a;
    padding: 2px 5px;
    border-radius: 4px;
  }
  .promo-text {
    color: #f0f0f0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.35;
    margin: 10px 0;
  }
  .promo-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 30px;
    border: none;
    border-radius: 5px;
    background: #9013fe;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
  }
  .promo-btn:hover {
    background: #9d2bff;
  }
  .dots {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding-top: 8px;
  }
  .dot {
    width: 4px;
    height: 4px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #4a4a4a;
  }
  .dot.on {
    background: #bdbdbd;
  }

  @media (max-width: 760px) {
    .sidebar:not(.collapsed) {
      position: fixed;
      left: 0;
      z-index: 60;
    }
  }
</style>
