<script lang="ts">
  import '../app.css';
  import Toast from '$lib/components/Toast.svelte';
  import { theme } from '$lib/stores/theme';
  import { preferences } from '$lib/stores/preferences';
  import { onboarding } from '$lib/stores/onboarding';
  import { onMount } from 'svelte';

  onMount(() => {
    theme.init();
    preferences.init();
    onboarding.init();
  });
</script>

<slot />
<Toast />
