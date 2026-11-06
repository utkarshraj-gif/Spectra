<script lang="ts">
  import { Mic, ShieldCheck, ArrowUp } from 'lucide-svelte';
  import Person from '$lib/components/illustrations/Person.svelte';
</script>

<div class="wrap">
  <div class="window">
    <div class="bar">
      <span class="lights"><i style="background:#ff5f57" /><i style="background:#febc2e" /><i style="background:#28c840" /></span>
      <span class="title">ZOOM</span>
    </div>
    <div class="body">
      <span class="shield"><ShieldCheck size={11} /></span>
      <div class="small">
        <Person bg="#d9d4cc" skin="#7a4a32" hair="#1d1410" shirt="#f3f0ea" hairStyle="curly" />
      </div>
      <div class="main">
        <Person bg="#8f969e" skin="#e7b48f" hair="#5a3b25" shirt="#f2f2f4" decor="office" beard />
      </div>
    </div>
    <div class="tools">
      <Mic size={11} color="#9a9a9a" />
      <span class="share"><ArrowUp size={9} /></span>
      <span class="end" />
    </div>
  </div>
  <div class="zoom-badge">zoom</div>
</div>

<style>
  .wrap {
    position: relative;
    width: 340px;
    max-width: 100%;
  }
  .window {
    background: #1b1b1d;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  .bar {
    position: relative;
    height: 22px;
    background: #fafafa;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lights {
    position: absolute;
    left: 8px;
    display: flex;
    gap: 4px;
  }
  .lights i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .title {
    font-size: 9px;
    letter-spacing: 0.08em;
    color: #333;
    font-weight: 600;
  }
  .body {
    position: relative;
    padding: 10px 50px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .shield {
    position: absolute;
    left: 8px;
    top: 8px;
    color: #28c840;
  }
  .small {
    width: 70px;
    height: 46px;
    overflow: hidden;
  }
  .main {
    width: 100%;
    height: 150px;
    overflow: hidden;
    border: 2px solid #e6f28a;
  }
  .tools {
    height: 28px;
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
  }
  .share {
    width: 14px;
    height: 12px;
    border-radius: 2px;
    background: #2bd46b;
    color: #0b2a17;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .end {
    width: 18px;
    height: 10px;
    border-radius: 2px;
    background: #c4122f;
  }
  .zoom-badge {
    position: absolute;
    top: -18px;
    right: -26px;
    width: 52px;
    height: 52px;
    border-radius: 10px;
    background: linear-gradient(145deg, #9013fe, #4f46e5 60%, #2f7cf6);
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  }
</style>
