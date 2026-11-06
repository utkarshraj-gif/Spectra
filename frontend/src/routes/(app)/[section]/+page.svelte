<script lang="ts">
  import { SECTIONS } from '$lib/components/app/nav';
  import type { PageData } from './$types';

  export let data: PageData;

  $: info = SECTIONS[data.section];
</script>

<div class="placeholder">
  <div class="icon"><svelte:component this={info.icon} size={22} /></div>
  <h1>{info.title}</h1>
  <p>{info.description}</p>
  <span class="soon">Coming soon</span>
  <a href="/home" class="back">Back to Home</a>
</div>

<style>
  .placeholder {
    max-width: 460px;
    margin: 12vh auto 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #24163a;
    border: 1px solid #3d2563;
    color: #c08cff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 6px;
  }
  h1 {
    font-size: 20px;
    font-weight: 600;
  }
  p {
    color: #9b9b9b;
    font-size: 14px;
    line-height: 1.5;
  }
  .soon {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #c99cff;
    background: #2a1645;
    padding: 4px 8px;
    border-radius: 4px;
    margin-top: 4px;
  }
  .back {
    margin-top: 12px;
    font-size: 13px;
    color: #d6d6d6;
    padding: 7px 12px;
    border: 1px solid #2e2e2e;
    border-radius: 6px;
  }
  .back:hover {
    background: #222;
  }
</style>
