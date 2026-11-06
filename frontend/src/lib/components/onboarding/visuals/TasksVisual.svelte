<script lang="ts">
  import { Check } from 'lucide-svelte';

  const samTasks = [
    { text: 'Work on compliance FAQ with security team.', done: false },
    { text: 'Check with PMs about pipeline options for HubSpot.', done: false },
    { text: 'Confirm interview schedule with Janice.', done: true }
  ];
</script>

<div class="card">
  <div class="head">
    <span class="logo-tile">S</span>
    <div>
      <div class="title">Sam &lt;&gt; Janice</div>
      <div class="date">Wed · 01:00 PM</div>
    </div>
  </div>

  <span class="tag sam">Sam</span>
  {#each samTasks as t}
    <div class="task" class:done={t.done}>
      <span class="box">{#if t.done}<Check size={10} strokeWidth={3} />{/if}</span>
      <span>{t.text}</span>
    </div>
  {/each}

  <span class="tag janice">Janice</span>
  {#each [70, 55] as w}
    <div class="task done">
      <span class="box"><Check size={10} strokeWidth={3} /></span>
      <span class="skel" style="width:{w}%" />
    </div>
  {/each}
  <div class="fade" />
</div>

<style>
  .card {
    position: relative;
    width: 280px;
    padding: 18px 20px 30px;
    border-radius: 12px;
    background: #1c1c1f;
    border: 1px solid #2a2a2e;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    font-family: 'Inter', sans-serif;
  }
  .head {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }
  .logo-tile {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: #2f6b3c;
    color: #c9f5d4;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .title {
    font-size: 12.5px;
    color: #e8e8e8;
  }
  .date {
    font-size: 10.5px;
    color: #8a8a8f;
    margin-top: 2px;
  }
  .tag {
    display: inline-block;
    font-size: 11px;
    padding: 3px 7px;
    border-radius: 4px;
    margin: 6px 0 8px;
  }
  .tag.sam {
    background: #213a2a;
    color: #b8e6c6;
  }
  .tag.janice {
    background: #4a1f2e;
    color: #f2b8cb;
  }
  .task {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 11.5px;
    color: #cfcfd4;
    line-height: 1.45;
    margin-bottom: 12px;
  }
  .task.done > span:last-child:not(.skel) {
    text-decoration: line-through;
    color: #6f6f75;
  }
  .box {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
    margin-top: 2px;
    border-radius: 3px;
    border: 1px solid #4a4a50;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  .done .box {
    background: #9013fe;
    border-color: #9013fe;
  }
  .skel {
    height: 7px;
    margin-top: 4px;
    border-radius: 4px;
    background: #333338;
  }
  .fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 50px;
    background: linear-gradient(transparent, #141416);
  }
</style>
