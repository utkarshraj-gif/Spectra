<script lang="ts">
  import '../app.css';
  import Navbar from '$lib/components/Navbar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { theme } from '$lib/stores/theme';
  import { preferences } from '$lib/stores/preferences';
  import { onMount } from 'svelte';

  onMount(() => {
    theme.init();
    preferences.init();
  });
</script>

<Navbar />
<main>
  <slot />
</main>
<Footer />
<Toast />