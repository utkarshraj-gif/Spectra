<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { CircleQuestionMark } from 'lucide-svelte';
  import Sidebar from '$lib/components/app/Sidebar.svelte';
  import Topbar from '$lib/components/app/Topbar.svelte';
  import { onboarding } from '$lib/stores/onboarding';
  import { toast } from '$lib/stores/toast';

  const COLLAPSE_KEY = 'spectra_sidebar_collapsed';

  let collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
  let ready = false;

  function toggleSidebar() {
    collapsed = !collapsed;
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }

  onMount(() => {
    onboarding.init();
    if (!$onboarding.setupDone) {
      goto('/onboarding', { replaceState: true });
      return;
    }
    ready = true;
  });
</script>

{#if ready}
  <div class="app-shell">
    <Sidebar {collapsed} />
    <div class="main">
      <Topbar on:toggleSidebar={toggleSidebar} />
      <div class="content">
        <slot />
      </div>
    </div>
    <button class="help" aria-label="Help" on:click={() => toast.info('Help center is coming soon.')}>
      <CircleQuestionMark size={20} />
    </button>
  </div>
{/if}

<style>
  .app-shell {
    --bg: #161616;
    --bg-elevated: #1e1e1e;
    --bg-muted: #262626;
    --text: #ececec;
    --text-muted: #9b9b9b;
    --border: #2b2b2b;
    --primary: #9013fe;
    --primary-fg: #ffffff;
    --accent: #b46cff;
    --card-shadow: none;

    display: flex;
    min-height: 100vh;
    background: #161616;
    color: var(--text);
    font-family: 'Inter', system-ui, sans-serif;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(1200px 380px at 15% -10%, rgba(70, 82, 110, 0.22), transparent 60%),
      radial-gradient(900px 300px at 85% -5%, rgba(120, 60, 30, 0.12), transparent 60%),
      #161616;
  }
  .content {
    flex: 1;
    padding: 28px 32px 64px;
  }
  .help {
    position: fixed;
    right: 18px;
    bottom: 18px;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 2px solid #2a1a40;
    background: #d9c7ff;
    color: #3b1a6b;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }
  .help:hover {
    background: #e6d9ff;
  }

  @media (max-width: 640px) {
    .content {
      padding: 20px 16px 64px;
    }
  }
</style>
