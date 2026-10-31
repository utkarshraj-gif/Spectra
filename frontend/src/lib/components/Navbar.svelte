<script lang="ts">
  import { theme } from '$lib/stores/theme';
  import { Sun, Moon, Sparkles } from 'lucide-svelte';
  import { onMount } from 'svelte';

  onMount(() => theme.init());
</script>

<header class="nav">
  <div class="container nav-inner">
    <a href="/" class="logo">
      <Sparkles size={22} />
      <span>Spectra</span>
    </a>

    <nav class="links">
      <a href="/#how">How It Works</a>
      <a href="/#pricing">Pricing</a>
      <a href="/#faq">FAQ</a>
    </nav>

    <div class="actions">
      <button class="theme-btn" on:click={() => theme.toggle()} aria-label="Toggle theme">
        {#if $theme === 'light'}
          <Moon size={18} />
        {:else}
          <Sun size={18} />
        {/if}
      </button>
      <a href="/login" class="btn btn-outline">Log in</a>
      <a href="/register" class="btn btn-primary">Sign Up</a>
    </div>
  </div>
</header>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.25rem;
  }
  .links {
    display: flex;
    gap: 2rem;
  }
  .links a {
    font-size: 0.95rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  .links a:hover {
    color: var(--text);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .theme-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
  }
  @media (max-width: 768px) {
    .links { display: none; }
  }
</style>