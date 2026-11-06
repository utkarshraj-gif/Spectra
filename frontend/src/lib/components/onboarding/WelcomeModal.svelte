<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-svelte';
  import BrandIcon from '$lib/components/brand/BrandIcon.svelte';
  import SpectraLogo from '$lib/components/brand/SpectraLogo.svelte';
  import TranscriptVisual from './visuals/TranscriptVisual.svelte';
  import NotetakerVisual from './visuals/NotetakerVisual.svelte';
  import ZoomVisual from './visuals/ZoomVisual.svelte';
  import { LANGUAGES, SOURCES } from './options';
  import { onboarding } from '$lib/stores/onboarding';
  import { preferences } from '$lib/stores/preferences';
  import { toast } from '$lib/stores/toast';

  const dispatch = createEventDispatcher<{ done: void }>();

  let step = 0;
  let language = $onboarding.language;
  let source = $onboarding.source;

  function next() {
    if (step === 0) {
      onboarding.patch({ language });
      const code = LANGUAGES.find((l) => l.id === language)?.code ?? 'en';
      preferences.update((p) => ({ ...p, transcription_language: code }));
    }
    if (step === 1) onboarding.patch({ source });
    step += 1;
  }

  function finish(zoom: 'connected' | 'skipped') {
    onboarding.patch({ zoom, welcomeDone: true });
    if (zoom === 'connected') toast.success('Zoom connected');
    dispatch('done');
  }
</script>

<div class="overlay" transition:fade={{ duration: 150 }}>
  <div class="modal" role="dialog" aria-modal="true" in:fly={{ y: 12, duration: 200 }}>
    <div class="left">
      <div class="top">
        {#if step > 0}
          <button class="back" aria-label="Back" on:click={() => (step -= 1)}><ArrowLeft size={16} /></button>
        {:else}
          <span />
        {/if}
        <div class="steps">
          {#each [0, 1, 2] as i}<span class:on={i === step} />{/each}
        </div>
      </div>

      <div class="body">
        {#if step === 0}
          <h2>Choose your meeting language</h2>
          <p class="sub">Transcribe meetings in your language. Spectra supports 100+ languages.</p>
          <label class="field-label" for="lang">Language</label>
          <div class="select">
            <select id="lang" bind:value={language}>
              {#each LANGUAGES as l}<option value={l.id}>{l.label}</option>{/each}
            </select>
            <ChevronDown size={16} />
          </div>
          <button class="primary" on:click={next}>Continue <ArrowRight size={15} /></button>
        {:else if step === 1}
          <h2>How did you hear about Spectra?</h2>
          <div class="chips">
            {#each SOURCES as s}
              <button class="chip" class:selected={source === s} on:click={() => (source = source === s ? '' : s)}>{s}</button>
            {/each}
          </div>
          <button class="primary" on:click={next}>Continue <ArrowRight size={15} /></button>
        {:else}
          <h2>Do you use Zoom?</h2>
          <p class="sub">Connect your Zoom account with Spectra to record and transcribe your Zoom meetings.</p>
          <div class="note">
            <div class="note-icons">
              <span class="tile zoom"><BrandIcon name="zoom" size={16} /></span>
              <span class="tile"><SpectraLogo size={14} /></span>
            </div>
            <p><strong>Important:</strong> Connect to make sure Spectra Notetaker can easily join and transcribe your Zoom meetings.</p>
          </div>
          <div class="actions">
            <button class="primary" on:click={() => finish('connected')}>Connect Zoom <ArrowUpRight size={15} /></button>
            <button class="text" on:click={() => finish('skipped')}>Not Now</button>
          </div>
        {/if}
      </div>
    </div>

    <div class="right">
      {#key step}
        <div class="visual" in:fade={{ duration: 200 }}>
          {#if step === 0}
            <TranscriptVisual />
          {:else if step === 1}
            <NotetakerVisual />
          {:else}
            <ZoomVisual />
          {/if}
        </div>
      {/key}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(8, 8, 10, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .modal {
    width: min(1040px, 100%);
    min-height: min(600px, calc(100vh - 48px));
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #2c2c2c;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
    font-family: 'Poppins', 'Inter', sans-serif;
  }
  .left {
    background: #212121;
    padding: 22px 34px 40px 72px;
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-left: -48px;
    height: 24px;
  }
  .back {
    background: none;
    border: none;
    color: #8a8a8a;
    display: flex;
    padding: 4px;
    border-radius: 4px;
  }
  .back:hover {
    color: #e6e6e6;
  }
  .steps {
    display: flex;
    gap: 4px;
  }
  .steps span {
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: #3a3a3a;
    transition: all 0.2s;
  }
  .steps span.on {
    width: 22px;
    background: #9013fe;
  }

  .body {
    margin-top: 76px;
    max-width: 380px;
  }
  h2 {
    font-size: 21px;
    font-weight: 500;
    color: #f2f2f2;
    letter-spacing: -0.01em;
  }
  .sub {
    margin-top: 12px;
    color: #b5b5b5;
    font-size: 13px;
    line-height: 1.6;
  }
  .field-label {
    display: block;
    margin: 22px 0 10px;
    color: #e6e6e6;
    font-size: 15px;
  }
  .select {
    position: relative;
    color: #8a8a8a;
  }
  .select select {
    width: 100%;
    height: 40px;
    appearance: none;
    background: #1a1a1a;
    border: 1px solid #2e2e2e;
    border-radius: 4px;
    padding: 0 36px 0 12px;
    color: #9a9a9a;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
  }
  .select select:focus {
    outline: none;
    border-color: #6b2bb5;
    color: #e6e6e6;
  }
  .select :global(svg) {
    position: absolute;
    right: 12px;
    top: 12px;
    pointer-events: none;
  }
  .primary {
    margin-top: 34px;
    height: 36px;
    padding: 0 14px;
    border: none;
    border-radius: 4px;
    background: #9013fe;
    color: #fff;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .primary:hover {
    background: #9d2bff;
  }
  .chips {
    margin-top: 22px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    height: 34px;
    padding: 0 12px;
    border-radius: 4px;
    border: 1px solid #333;
    background: #1d1d1d;
    color: #cfcfcf;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
  }
  .chip:hover {
    border-color: #4a4a4a;
  }
  .chip.selected {
    border-color: #9013fe;
    background: rgba(144, 19, 254, 0.14);
    color: #c895ff;
  }
  .note {
    margin-top: 22px;
    padding: 12px;
    background: #1b1b1b;
    border: 1px solid #2c2c2c;
    border-radius: 4px;
  }
  .note-icons {
    display: flex;
    gap: 4px;
  }
  .tile {
    width: 26px;
    height: 26px;
    border-radius: 5px;
    border: 1px solid #333;
    background: #262626;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .note p {
    margin-top: 10px;
    color: #a8a8a8;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.5;
  }
  .note strong {
    color: #d6d6d6;
    font-weight: 500;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .actions .primary {
    margin-top: 34px;
  }
  .text {
    margin-top: 34px;
    background: none;
    border: none;
    color: #cfcfcf;
    font-family: inherit;
    font-size: 13px;
  }
  .text:hover {
    color: #fff;
  }

  .right {
    background: #2a0f4a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }
  .visual {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  @media (max-width: 860px) {
    .modal {
      grid-template-columns: 1fr;
    }
    .right {
      display: none;
    }
    .left {
      padding: 22px 24px 32px 56px;
    }
    .body {
      margin-top: 32px;
    }
  }
</style>
