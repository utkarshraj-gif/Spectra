<script lang="ts">
  import { Mic, Video, Phone } from 'lucide-svelte';
  import Person from '$lib/components/illustrations/Person.svelte';
</script>

<div class="wrap">
  <svg class="mascot" viewBox="0 0 120 90" aria-hidden="true">
    <g fill="#9b2cf7">
      <line x1="38" y1="36" x2="32" y2="14" stroke="#9b2cf7" stroke-width="5" stroke-linecap="round" />
      <line x1="82" y1="36" x2="88" y2="14" stroke="#9b2cf7" stroke-width="5" stroke-linecap="round" />
      <circle cx="31" cy="11" r="9" />
      <circle cx="89" cy="11" r="9" />
      <path d="M18 90 V58 C18 40 36 30 60 30 C84 30 102 40 102 58 V90 Z" />
    </g>
    <g fill="#e9d6ff">
      <circle cx="12" cy="80" r="9" />
      <circle cx="108" cy="80" r="9" />
    </g>
    <rect x="30" y="44" width="60" height="34" rx="16" fill="#1b0f2b" />
    <g stroke="#e9d6ff" stroke-width="3.2" fill="none" stroke-linecap="round">
      <path d="M43 59 Q48 53 53 59" />
      <path d="M67 59 Q72 53 77 59" />
      <path d="M53 67 Q60 72 67 67" />
    </g>
  </svg>

  <div class="call">
    <div class="tiles">
      <div class="tile">
        <Person bg="#e4e1dc" skin="#f1c9a8" hair="#e2c07a" shirt="#efc6d6" hairStyle="long" />
      </div>
      <div class="tile">
        <Person bg="#cfc6b8" skin="#7a4a32" hair="#1d1410" shirt="#8fb3d9" decor="shelf" headset beard />
      </div>
    </div>
    <div class="controls">
      <span class="ctl"><Mic size={13} /></span>
      <span class="ctl"><Video size={13} /></span>
      <span class="ctl end"><Phone size={13} /></span>
    </div>
  </div>
</div>

<style>
  .wrap {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .mascot {
    width: 110px;
    margin-bottom: -6px;
    position: relative;
    z-index: 1;
  }
  .call {
    width: 100%;
    background: #18181b;
    padding: 16px 0 12px;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .tile {
    height: 260px;
    border-radius: 10px;
    overflow: hidden;
  }
  .controls {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 16px;
  }
  .ctl {
    width: 36px;
    height: 26px;
    border-radius: 6px;
    background: #2a2a2e;
    color: #cfcfcf;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ctl.end {
    background: #d8193b;
    color: #fff;
  }
  .ctl.end :global(svg) {
    transform: rotate(135deg);
  }
</style>
