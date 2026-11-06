<script lang="ts">
  import { Sparkles, AudioLines, Mic, Video, Phone } from 'lucide-svelte';
  import Person from '$lib/components/illustrations/Person.svelte';
  import SpectraLogo from '$lib/components/brand/SpectraLogo.svelte';
</script>

<div class="wrap">
  <div class="stage">
    <div class="notes"><Sparkles size={11} color="#7cf2a4" /> Spectra is taking notes...</div>
    <div class="tile">
      <Person bg="#8f969e" skin="#e7b48f" hair="#5a3b25" shirt="#f2f2f4" decor="office" beard />
      <span class="wave"><AudioLines size={11} /></span>
      <span class="tag">Sam</span>
    </div>
    <div class="bot">
      <span class="bot-logo"><SpectraLogo size={22} /></span>
      <span class="tag">Sam's Spectra Notetaker</span>
    </div>
  </div>
  <div class="controls">
    <span class="ctl"><Mic size={12} /></span>
    <span class="ctl"><Video size={12} /></span>
    <span class="ctl end"><Phone size={12} /></span>
  </div>
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 26px;
  }
  .stage {
    position: relative;
    width: 330px;
    height: 230px;
  }
  .notes {
    position: absolute;
    top: -22px;
    left: 46px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    font-size: 11px;
    color: #f2f2f2;
    background: #101014;
    border: 1.5px solid #6ee7a3;
    border-bottom: none;
    border-radius: 7px 7px 0 0;
  }
  .tile {
    position: absolute;
    left: 0;
    top: 0;
    width: 260px;
    height: 150px;
    border-radius: 8px;
    overflow: hidden;
    border: 2.5px solid #8f8bff;
  }
  .wave {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #5b5bf0;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tag {
    position: absolute;
    left: 10px;
    bottom: 8px;
    color: #fff;
    font-size: 11.5px;
    font-weight: 500;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .bot {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 200px;
    height: 120px;
    border-radius: 8px;
    background: #9013fe;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bot-logo {
    width: 48px;
    height: 48px;
    border-radius: 7px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  .ctl {
    width: 34px;
    height: 22px;
    border-radius: 11px;
    background: #d8c6ff;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ctl.end {
    background: #ee1d3b;
  }
  .ctl.end :global(svg) {
    transform: rotate(135deg);
  }
</style>
