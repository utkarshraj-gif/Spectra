<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowRight } from 'lucide-svelte';
  import OnboardingFrame from '$lib/components/onboarding/OnboardingFrame.svelte';
  import NotesVisual from '$lib/components/onboarding/visuals/NotesVisual.svelte';
  import BrandIcon from '$lib/components/brand/BrandIcon.svelte';
  import { TOOLS } from '$lib/components/onboarding/options';
  import { onboarding } from '$lib/stores/onboarding';

  let selected = new Set($onboarding.tools);

  function toggle(id: string) {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    selected = selected;
  }

  function next() {
    onboarding.patch({ tools: [...selected] });
    goto('/onboarding/team');
  }
</script>

<svelte:head><title>Customize your experience · Spectra</title></svelte:head>

<OnboardingFrame progress={50} backHref="/onboarding/role">
  <h1 class="ob-title">Let's customize your experience</h1>

  <span class="ob-label">Which tools do you use?</span>
  <div class="ob-chips">
    {#each TOOLS as tool}
      <button class="ob-chip" class:selected={selected.has(tool.id)} on:click={() => toggle(tool.id)}>
        {#if tool.brand}<BrandIcon name={tool.brand} size={13} />{/if}
        {tool.label}
      </button>
    {/each}
  </div>

  <button class="ob-primary" on:click={next}>Continue <ArrowRight size={16} /></button>

  <NotesVisual slot="visual" />
</OnboardingFrame>
