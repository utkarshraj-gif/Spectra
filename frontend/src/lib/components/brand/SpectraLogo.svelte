<script lang="ts">
  export let size = 22;
  export let wordmark = false;
  export let color: string | null = null;

  const gid = `spectra-grad-${Math.random().toString(36).slice(2, 8)}`;
</script>

<span class="logo" style="--size:{size}px">
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff3d9a" />
        <stop offset="100%" stop-color="#d1086b" />
      </linearGradient>
    </defs>
    <g fill={color ?? `url(#${gid})`}>
      <rect x="4" y="2.5" width="16" height="5" rx="1.4" />
      <rect x="4" y="2.5" width="5" height="11" rx="1.4" />
      <rect x="4" y="9.5" width="16" height="5" rx="1.4" />
      <rect x="15" y="9.5" width="5" height="12" rx="1.4" />
      <rect x="4" y="16.5" width="16" height="5" rx="1.4" />
    </g>
  </svg>
  {#if wordmark}<span class="word">spectra.ai</span>{/if}
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
  }
  .word {
    font-family: 'DM Sans', 'Inter', sans-serif;
    font-weight: 600;
    font-size: calc(var(--size) * 0.82);
    color: #f2f2f2;
    letter-spacing: -0.01em;
  }
</style>
