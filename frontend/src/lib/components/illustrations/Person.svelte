<script lang="ts">
  export let bg = '#c9ccd3';
  export let skin = '#e8b996';
  export let hair = '#3b2a20';
  export let shirt = '#f4f4f6';
  export let hairStyle: 'short' | 'long' | 'curly' = 'short';
  export let decor: 'plain' | 'office' | 'shelf' = 'plain';
  export let headset = false;
  export let beard = false;
</script>

<div class="frame" style="background:{bg}">
<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" class="person" aria-hidden="true">
  <rect width="100" height="100" fill={bg} />

  {#if decor === 'office'}
    <g fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="0.8">
      <ellipse cx="78" cy="14" rx="16" ry="5" />
      <ellipse cx="78" cy="14" rx="10" ry="3" />
    </g>
  {:else if decor === 'shelf'}
    <g>
      <rect x="60" y="10" width="40" height="2" fill="#6b5640" />
      <rect x="62" y="0" width="4" height="10" fill="#b5562f" />
      <rect x="67" y="2" width="3" height="8" fill="#e7d3a6" />
      <rect x="71" y="1" width="5" height="9" fill="#46607a" />
      <rect x="78" y="3" width="3" height="7" fill="#8c3b3b" />
      <rect x="60" y="34" width="40" height="2" fill="#6b5640" />
      <rect x="63" y="22" width="4" height="12" fill="#d9b25d" />
      <rect x="68" y="24" width="3" height="10" fill="#4d7a5a" />
      <rect x="86" y="21" width="6" height="13" fill="#c96f45" />
      <rect x="0" y="18" width="18" height="2" fill="#6b5640" />
      <rect x="3" y="8" width="4" height="10" fill="#5b7aa8" />
      <rect x="8" y="10" width="3" height="8" fill="#d6c08c" />
    </g>
  {/if}

  {#if hairStyle === 'long'}
    <path d="M33 50 C30 28 42 24 50 24 C60 24 71 28 67 50 L70 76 L30 76 Z" fill={hair} />
  {/if}

  <path d="M12 100 C12 79 29 69 50 69 C71 69 88 79 88 100 Z" fill={shirt} />
  <path d="M43 69 L50 78 L57 69 Z" fill="rgba(0,0,0,0.08)" />
  <rect x="44" y="56" width="12" height="15" rx="4" fill={skin} />
  <rect x="44" y="56" width="12" height="6" fill="rgba(0,0,0,0.08)" />
  <ellipse cx="50" cy="45" rx="14" ry="16.5" fill={skin} />

  {#if hairStyle === 'short'}
    <path d="M35.5 44 C34 28 44 25.5 50.5 25.5 C59 25.5 67 29 64.5 44 C63 36 57.5 33.5 50 33.5 C43 33.5 37.5 36 35.5 44 Z" fill={hair} />
  {:else if hairStyle === 'curly'}
    <g fill={hair}>
      <circle cx="40" cy="32" r="7" />
      <circle cx="50" cy="28" r="8" />
      <circle cx="60" cy="32" r="7" />
      <circle cx="36" cy="40" r="5" />
      <circle cx="64" cy="40" r="5" />
    </g>
  {:else}
    <path d="M36 44 C36 30 44 27 50 27 C57 27 64 30 64 42 C58 36 46 34 36 44 Z" fill={hair} />
  {/if}

  {#if beard}
    <path d="M37 48 C38 60 44 63 50 63 C56 63 62 60 63 48 C60 55 56 57 50 57 C44 57 40 55 37 48 Z" fill={hair} opacity="0.85" />
  {/if}

  <g fill="#2a1d17">
    <ellipse cx="44.5" cy="45" rx="1.3" ry="1.6" />
    <ellipse cx="55.5" cy="45" rx="1.3" ry="1.6" />
  </g>
  <path d="M45.5 52.5 Q50 55.5 54.5 52.5" stroke="#8a4a3a" stroke-width="1.3" fill="none" stroke-linecap="round" />

  {#if headset}
    <path d="M34 46 C33 24 67 24 66 46" stroke="#1d1d1f" stroke-width="2.4" fill="none" />
    <rect x="31" y="42" width="6" height="10" rx="2.5" fill="#1d1d1f" />
    <rect x="63" y="42" width="6" height="10" rx="2.5" fill="#1d1d1f" />
    <path d="M34 51 C35 58 40 60 45 59" stroke="#1d1d1f" stroke-width="1.6" fill="none" />
  {/if}
</svg>
</div>

<style>
  .frame {
    width: 100%;
    height: 100%;
  }
  .person {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
