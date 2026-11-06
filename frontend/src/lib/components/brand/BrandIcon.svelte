<script context="module" lang="ts">
  export type Brand =
    | 'windows'
    | 'apple'
    | 'appstore'
    | 'googleplay'
    | 'chrome'
    | 'zoom'
    | 'jira'
    | 'linear'
    | 'confluence'
    | 'notion'
    | 'slack'
    | 'asana'
    | 'zapier';
</script>

<script lang="ts">
  export let name: Brand;
  export let size = 16;
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="brand">
  {#if name === 'windows'}
    <g fill="#3ba0ff">
      <rect x="3" y="3" width="8.4" height="8.4" rx="0.6" />
      <rect x="12.6" y="3" width="8.4" height="8.4" rx="0.6" />
      <rect x="3" y="12.6" width="8.4" height="8.4" rx="0.6" />
      <rect x="12.6" y="12.6" width="8.4" height="8.4" rx="0.6" />
    </g>
  {:else if name === 'apple'}
    <path
      fill="#f2f2f2"
      d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.83-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.08 1.96-.49 2.56-1.2z"
    />
  {:else if name === 'appstore'}
    <rect x="2" y="2" width="20" height="20" rx="5" fill="#1a8cff" />
    <g stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M8.2 16.5 12.4 8" />
      <path d="M15.8 16.5 11.6 8" />
      <path d="M7 13.8h10" />
    </g>
  {:else if name === 'googleplay'}
    <polygon points="5,3 13,12 5,21" fill="#00a0ff" />
    <polygon points="5,3 16.5,9.5 13,12" fill="#00d26a" />
    <polygon points="5,21 13,12 16.5,14.5" fill="#ff3a44" />
    <polygon points="16.5,9.5 20,12 16.5,14.5 13,12" fill="#ffc400" />
  {:else if name === 'chrome'}
    <path d="M12 12 3.34 7A10 10 0 0 1 20.66 7Z" fill="#ea4335" />
    <path d="M12 12 20.66 7A10 10 0 0 1 12 22Z" fill="#fbbc04" />
    <path d="M12 12 12 22A10 10 0 0 1 3.34 7Z" fill="#34a853" />
    <circle cx="12" cy="12" r="4.6" fill="#fff" />
    <circle cx="12" cy="12" r="3.6" fill="#4285f4" />
  {:else if name === 'zoom'}
    <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#0b5cff" />
    <rect x="5" y="8.2" width="9.5" height="7.6" rx="1.8" fill="#fff" />
    <path d="M15.3 11.1 19 8.8v6.4l-3.7-2.3Z" fill="#fff" />
  {:else if name === 'jira'}
    <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" fill="#2684ff" />
    <path d="M12 8.2 15.8 12 12 15.8 8.2 12Z" fill="#0c1a33" />
  {:else if name === 'linear'}
    <circle cx="12" cy="12" r="9.5" fill="#7c86ea" />
    <path d="M5 13.6 10.4 19M4.6 10.4l9 9M6.2 7.2l10.6 10.6" stroke="#1b1d3a" stroke-width="1.3" />
  {:else if name === 'confluence'}
    <g fill="none" stroke="#2f7cf6" stroke-width="3.2" stroke-linecap="round">
      <path d="M4 17.5c4-6 8.5-7 16-3" />
      <path d="M4 9.5c7.5 4 12 3 16-3" />
    </g>
  {:else if name === 'notion'}
    <rect x="3.5" y="3" width="17" height="18" rx="2.6" fill="#fff" stroke="#111" stroke-width="1.4" />
    <path d="M8.6 7.5v9M8.6 7.5l6.8 9M15.4 7.5v9" stroke="#111" stroke-width="1.7" fill="none" stroke-linecap="round" />
  {:else if name === 'slack'}
    <rect x="2" y="8.6" width="9.4" height="3" rx="1.5" fill="#36c5f0" />
    <circle cx="9.9" cy="3.5" r="1.5" fill="#36c5f0" />
    <rect x="8.4" y="2" width="3" height="5.2" rx="1.5" fill="#36c5f0" />
    <rect x="12.6" y="2" width="3" height="9.4" rx="1.5" fill="#2eb67d" />
    <rect x="16.8" y="8.4" width="5.2" height="3" rx="1.5" fill="#2eb67d" />
    <rect x="12.6" y="12.4" width="9.4" height="3" rx="1.5" fill="#ecb22e" />
    <rect x="12.6" y="16.8" width="3" height="5.2" rx="1.5" fill="#ecb22e" />
    <rect x="8.4" y="12.6" width="3" height="9.4" rx="1.5" fill="#e01e5a" />
    <rect x="2" y="12.6" width="5.2" height="3" rx="1.5" fill="#e01e5a" />
  {:else if name === 'asana'}
    <g fill="#f06a6a">
      <circle cx="12" cy="7" r="4" />
      <circle cx="6.3" cy="15.5" r="4" />
      <circle cx="17.7" cy="15.5" r="4" />
    </g>
  {:else if name === 'zapier'}
    <g stroke="#ff4f00" stroke-width="3" stroke-linecap="round">
      <path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" />
    </g>
    <circle cx="12" cy="12" r="2.4" fill="#ff4f00" />
  {/if}
</svg>

<style>
  .brand {
    flex-shrink: 0;
    display: block;
  }
</style>
