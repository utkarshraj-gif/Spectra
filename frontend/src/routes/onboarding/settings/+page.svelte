<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowRight, ChevronDown, Zap, Info } from 'lucide-svelte';
  import OnboardingFrame from '$lib/components/onboarding/OnboardingFrame.svelte';
  import CallVisual from '$lib/components/onboarding/visuals/CallVisual.svelte';
  import { onboarding, type JoinMode, type RecapMode } from '$lib/stores/onboarding';
  import { preferences } from '$lib/stores/preferences';

  let joinMode: JoinMode = $onboarding.joinMode;
  let recapMode: RecapMode = $onboarding.recapMode;

  // Unlimited transcripts require the notetaker to join every meeting and share recaps with everyone.
  $: unlimited = joinMode === 'all' && recapMode === 'everyone';

  function toggleUnlimited() {
    if (unlimited) {
      recapMode = 'me';
    } else {
      joinMode = 'all';
      recapMode = 'everyone';
    }
  }

  function finish() {
    onboarding.patch({ joinMode, recapMode, unlimitedTranscripts: unlimited, setupDone: true });
    preferences.update((p) => ({ ...p, auto_join_calendar: joinMode !== 'manual' }));
    goto('/home');
  }
</script>

<svelte:head><title>Review meeting settings · Spectra</title></svelte:head>

<OnboardingFrame>
  <h1 class="ob-title">Important: Please review your meeting settings</h1>

  <button class="unlimited" role="switch" aria-checked={unlimited} on:click={toggleUnlimited}>
    <Zap size={17} />
    <span>Enable unlimited free transcripts</span>
    <span class="switch" class:on={unlimited}><span /></span>
  </button>

  <label class="label" for="join">Meetings Spectra will join:</label>
  <div class="ob-select">
    <select id="join" bind:value={joinMode}>
      <option value="all">All meetings with web-conf link</option>
      <option value="owned">Only meetings I own</option>
      <option value="manual">Only when I invite Spectra</option>
    </select>
    <ChevronDown size={16} />
  </div>

  <label class="label" for="recap">Send meeting recaps to:</label>
  <div class="ob-select">
    <select id="recap" bind:value={recapMode}>
      <option value="everyone">Everyone on the invite</option>
      <option value="team">Only participants from my team</option>
      <option value="me">Only me</option>
    </select>
    <ChevronDown size={16} />
  </div>

  <button class="ob-primary" on:click={finish}>Continue <ArrowRight size={16} /></button>

  <div class="hint">
    <Info size={13} />
    Users on Join-All and Share-All settings get unlimited meeting transcripts.
  </div>

  <CallVisual slot="visual" />
</OnboardingFrame>

<style>
  .unlimited {
    margin-top: 52px;
    width: 100%;
    height: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-radius: 6px;
    border: 1px solid #222226;
    background: #1d1d20;
    color: #ececec;
    font-family: inherit;
    font-size: 14px;
    text-align: left;
  }
  .unlimited span:nth-child(2) {
    flex: 1;
  }
  .unlimited :global(svg) {
    color: #b9b9be;
  }
  .switch {
    width: 30px;
    height: 16px;
    border-radius: 8px;
    background: #3a3a3f;
    position: relative;
    transition: background 0.15s;
  }
  .switch span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }
  .switch.on {
    background: #9013fe;
  }
  .switch.on span {
    transform: translateX(14px);
  }
  .label {
    display: block;
    margin: 26px 0 10px;
    font-size: 13px;
    color: #b4b4b8;
  }
  .hint {
    margin-top: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 4px;
    background: #1a1a1d;
    border: 1px solid #222226;
    color: #a8a8ad;
    font-size: 12px;
  }
</style>
