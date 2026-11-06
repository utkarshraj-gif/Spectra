<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowRight, ChevronDown } from 'lucide-svelte';
  import OnboardingFrame from '$lib/components/onboarding/OnboardingFrame.svelte';
  import NotesVisual from '$lib/components/onboarding/visuals/NotesVisual.svelte';
  import { ROLE_TITLES } from '$lib/components/onboarding/options';
  import { onboarding } from '$lib/stores/onboarding';

  let role = $onboarding.role in ROLE_TITLES ? $onboarding.role : 'Engineering';
  let title = $onboarding.title;

  $: titles = ROLE_TITLES[role];
  $: if (!titles.includes(title)) title = titles[0];

  function next() {
    onboarding.patch({ role, title });
    goto('/onboarding/tools');
  }
</script>

<svelte:head><title>Customize your experience · Spectra</title></svelte:head>

<OnboardingFrame progress={25} backHref="/register">
  <h1 class="ob-title">Let's customize your experience</h1>

  <label class="ob-label" for="role">What's your role?</label>
  <div class="ob-select">
    <select id="role" bind:value={role}>
      {#each Object.keys(ROLE_TITLES) as r}<option value={r}>{r}</option>{/each}
    </select>
    <ChevronDown size={16} />
  </div>

  <span class="ob-label">What's your title?</span>
  <div class="ob-chips">
    {#each titles as t}
      <button class="ob-chip" class:selected={title === t} on:click={() => (title = t)}>{t}</button>
    {/each}
  </div>

  <button class="ob-primary" on:click={next}>Continue <ArrowRight size={16} /></button>

  <NotesVisual slot="visual" />
</OnboardingFrame>
