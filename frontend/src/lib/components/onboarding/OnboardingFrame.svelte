<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import SpectraLogo from '$lib/components/brand/SpectraLogo.svelte';

  /** 0–100, or null to hide the bar. */
  export let progress: number | null = null;
  export let backHref: string | null = null;
</script>

<div class="frame">
  {#if progress !== null}
    <div class="progress"><span style="width:{progress}%" /></div>
  {/if}

  <div class="left">
    <header>
      {#if backHref}
        <a class="back" href={backHref} aria-label="Back"><ArrowLeft size={16} /></a>
      {/if}
      <SpectraLogo size={20} wordmark />
    </header>
    <div class="content">
      <slot />
    </div>
  </div>

  <div class="right">
    <slot name="visual" />
  </div>
</div>

<style>
  .frame {
    position: relative;
    min-height: 100vh;
    display: grid;
    grid-template-columns: 55fr 45fr;
    background: #0c0c0e;
    color: #f2f2f2;
    font-family: 'DM Sans', 'Inter', sans-serif;
  }
  .progress {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 2;
  }
  .progress span {
    display: block;
    height: 100%;
    background: #9013fe;
    transition: width 0.35s ease;
  }
  .left {
    padding: 26px 40px 48px 32px;
    display: flex;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 28px;
    min-height: 28px;
  }
  .back {
    color: #cfcfcf;
    display: flex;
    padding: 4px;
    border-radius: 4px;
  }
  .back:hover {
    color: #fff;
    background: #1c1c1f;
  }
  .content {
    margin-top: 64px;
    padding-left: 44px;
    max-width: 520px;
  }
  .right {
    background: #141416;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px;
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .frame {
      grid-template-columns: 1fr;
    }
    .right {
      display: none;
    }
    .content {
      padding-left: 0;
      margin-top: 40px;
    }
  }
</style>
