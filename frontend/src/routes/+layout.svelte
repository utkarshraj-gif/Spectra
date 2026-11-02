<script lang="ts">
  import '../app.css';
  import Navbar from '$lib/components/Navbar.svelte';
  import Footer from '$lib/components/Footer.svelte';
  import { theme } from '$lib/stores/theme';
  import { onMount } from 'svelte';

  onMount(() => theme.init());
</script>

<Navbar />
<main>
  <slot />
</main>
<Footer />