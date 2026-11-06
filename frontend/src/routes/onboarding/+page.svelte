<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { onboarding } from '$lib/stores/onboarding';

  onMount(() => {
    const s = $onboarding;
    const next = s.setupDone ? '/home' : s.team !== null ? '/onboarding/settings' : '/onboarding/role';
    goto(next, { replaceState: true });
  });
</script>
