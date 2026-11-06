<script lang="ts">
  import { Search, Bookmark, ChevronDown } from 'lucide-svelte';

  const bubbles = [
    { text: 'Hola', flag: 'es', cls: 'b1' },
    { text: 'Cześć', flag: 'pl', cls: 'b2' },
    { text: 'नमस्ते', flag: 'in', cls: 'b3' },
    { text: 'Hoi', flag: 'nl', cls: 'b4' }
  ];
</script>

<div class="wrap">
  <div class="card">
    <div class="head">Transcript <span class="live">LIVE</span></div>
    <div class="search"><Search size={12} /> Search</div>

    <div class="row">
      <div class="who">
        <span class="av" style="background:#1f6b3a">C</span>
        <span class="name">Cate</span><ChevronDown size={11} />
        <span class="dot">·</span><span class="ts">00:53</span>
      </div>
      <p class="hl"><mark>There's some concern about onboarding. Clients feel it's not intuitive enough.</mark></p>
      <span class="bm"><Bookmark size={12} fill="#f5c518" color="#f5c518" /></span>
    </div>

    <div class="row">
      <div class="who">
        <span class="av" style="background:#e04fb5">T</span>
        <span class="name">Tom</span><ChevronDown size={11} />
        <span class="dot">·</span><span class="ts">01:24</span>
      </div>
      <div class="skel" style="width:88%" />
      <div class="skel" style="width:64%" />
    </div>

    <div class="row">
      <div class="who">
        <span class="av" style="background:#f2a56b">R</span>
        <span class="name">Rohan</span><ChevronDown size={11} />
        <span class="dot">·</span><span class="ts">01:47</span>
      </div>
      <div class="skel" style="width:80%" />
    </div>
    <div class="fade" />
  </div>

  {#each bubbles as b}
    <div class="bubble {b.cls}"><span class="flag {b.flag}" />{b.text}</div>
  {/each}
</div>

<style>
  .wrap {
    position: relative;
    width: 330px;
    max-width: 100%;
  }
  .card {
    position: relative;
    background: #fff;
    border-radius: 8px;
    padding: 16px 16px 40px;
    color: #1b1b1f;
    overflow: hidden;
    font-family: 'Inter', sans-serif;
  }
  .head {
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .live {
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: #f1708a;
    padding: 2px 5px;
    border-radius: 3px;
  }
  .search {
    margin: 14px 0 16px;
    height: 30px;
    border-radius: 5px;
    background: #f3f3f5;
    color: #9a9aa5;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
  }
  .row {
    position: relative;
    margin-bottom: 16px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #3a3a44;
    margin-bottom: 6px;
  }
  .av {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .name {
    font-weight: 500;
  }
  .dot {
    color: #aaa;
  }
  .ts {
    color: #7c3aed;
    text-decoration: underline;
    font-size: 11.5px;
  }
  .hl {
    font-size: 12.5px;
    line-height: 1.55;
    padding-left: 21px;
  }
  mark {
    background: #fff6c7;
    color: inherit;
    padding: 1px 0;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .bm {
    display: block;
    padding-left: 21px;
    margin-top: 4px;
  }
  .skel {
    height: 8px;
    border-radius: 4px;
    background: #ededf1;
    margin: 7px 0 0 21px;
  }
  .fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 70px;
    background: linear-gradient(transparent, #e9ddff);
  }

  .bubble {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 6px;
    background: #fff;
    color: #1b1b1f;
    font-size: 12.5px;
    font-weight: 500;
    padding: 6px 10px 6px 6px;
    border-radius: 6px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
    white-space: nowrap;
  }
  .b1 {
    top: -16px;
    right: 22px;
  }
  .b2 {
    top: 48%;
    right: -40px;
  }
  .b3 {
    top: 70%;
    right: -26px;
  }
  .b4 {
    bottom: -16px;
    left: 18px;
  }
  .flag {
    width: 17px;
    height: 17px;
    border-radius: 50%;
    position: relative;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
  }
  .flag.es {
    background: linear-gradient(#c60b1e 27%, #ffc400 27% 73%, #c60b1e 73%);
  }
  .flag.pl {
    background: linear-gradient(#ffffff 50%, #dc143c 50%);
  }
  .flag.in {
    background: linear-gradient(#ff9933 34%, #ffffff 34% 66%, #138808 66%);
  }
  .flag.in::after {
    content: '';
    position: absolute;
    inset: 0;
    margin: auto;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #000080;
  }
  .flag.nl {
    background: linear-gradient(#ae1c28 34%, #ffffff 34% 66%, #21468b 66%);
  }
</style>
