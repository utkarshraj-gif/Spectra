<script lang="ts">
  import { goto } from '$app/navigation';
  import { Smile, User, TrendingUp, GraduationCap, Megaphone, Video } from 'lucide-svelte';

  let meetUrl = '';
  let rotating = ['transcripts', 'notes', 'summaries', 'action items'];
  let idx = 0;

  setInterval(() => {
    idx = (idx + 1) % rotating.length;
  }, 2200);

  function handleExtract() {
    if (!meetUrl.trim()) return;
    // later this will call the real API
    goto(`/meetings/new?url=${encodeURIComponent(meetUrl)}`);
  }
</script>

<section class="hero">
  <div class="container">
    <h1>
      Instantly turn any meeting into
      <span class="underline">{rotating[idx]}</span>
    </h1>

    <div class="input-row">
      <input
        type="url"
        bind:value={meetUrl}
        placeholder="https://meet.google.com/abc-defg-hij"
      />
      <button class="btn btn-primary" on:click={handleExtract}>Extract</button>
    </div>

    <div class="trust">
      <div><Smile size={16} /> No credit card required</div>
      <div><User size={16} /> Free to start</div>
      <div><TrendingUp size={16} /> Local & private</div>
    </div>
  </div>
</section>

<!-- Product mockup placeholder -->
<section class="demo">
  <div class="container">
    <div class="demo-card card">
      <div class="demo-header">
        <span>Dashboard › Meetings › Live Session</span>
      </div>
      <div class="demo-body">
        <div class="left">
          <div class="fake-video"></div>
        </div>
        <div class="right">
          <h3>Transcript</h3>
          <p class="seg"><span>00:12</span> Let's review the project plan for Q4.</p>
          <p class="seg"><span>00:28</span> We need to finalize the API contracts this week.</p>
          <p class="seg"><span>00:41</span> Action item: Mahi will own the frontend polish.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="how" class="section">
  <div class="container">
    <h2>How does it work?</h2>
    <div class="steps">
      <div class="step card">
        <div class="num">1</div>
        <h3>Paste a Google Meet URL</h3>
        <p>Submit any Meet link. Spectra launches a bot that joins when permitted.</p>
      </div>
      <div class="step card">
        <div class="num">2</div>
        <h3>Capture & transcribe</h3>
        <p>Audio is captured with consent and transcribed locally with timestamps.</p>
      </div>
      <div class="step card">
        <div class="num">3</div>
        <h3>Get insights</h3>
        <p>View the full transcript, search it, and extract action items.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2>Built for teams who live in meetings</h2>
    <div class="usecases">
      <div class="card use">
        <GraduationCap size={28} />
        <h3>Students & Researchers</h3>
        <p>Never miss a lecture detail. Searchable archive of every class.</p>
      </div>
      <div class="card use">
        <Megaphone size={28} />
        <h3>Product & Marketing</h3>
        <p>Turn customer calls into clean notes and action items instantly.</p>
      </div>
      <div class="card use">
        <Video size={28} />
        <h3>Remote Teams</h3>
        <p>Keep everyone aligned even if they couldn’t attend live.</p>
      </div>
    </div>
  </div>
</section>

<section id="pricing" class="section">
  <div class="container">
    <h2>Simple pricing</h2>
    <p class="subtitle">Start free. Upgrade when you need more.</p>
    <div class="pricing">
      <div class="card price">
        <h3>Free</h3>
        <div class="amount">$0</div>
        <ul>
          <li>5 meetings / month</li>
          <li>Local transcription</li>
          <li>Basic transcript viewer</li>
        </ul>
        <a href="/register" class="btn btn-outline">Get started</a>
      </div>
      <div class="card price featured">
        <div class="badge">Popular</div>
        <h3>Pro</h3>
        <div class="amount">$12<span>/mo</span></div>
        <ul>
          <li>Unlimited meetings</li>
          <li>Priority processing</li>
          <li>Export + search</li>
          <li>Calendar integration</li>
        </ul>
        <a href="/register" class="btn btn-primary">Subscribe</a>
      </div>
    </div>
  </div>
</section>

<style>
  .hero {
    padding: 6rem 0 4rem;
    text-align: center;
  }
  h1 {
    font-size: clamp(2.2rem, 5vw, 3.4rem);
    font-weight: 800;
    line-height: 1.15;
    max-width: 780px;
    margin: 0 auto 2.5rem;
  }
  .underline {
    text-decoration: underline;
    text-underline-offset: 6px;
    text-decoration-thickness: 3px;
  }
  .input-row {
    display: flex;
    gap: 0.75rem;
    max-width: 560px;
    margin: 0 auto 1.75rem;
  }
  .input-row input {
    flex: 1;
    padding: 0.9rem 1.1rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text);
    font-size: 1rem;
  }
  .trust {
    display: flex;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
    color: var(--text-muted);
    font-size: 0.9rem;
  }
  .trust div {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .demo {
    padding: 2rem 0 4rem;
  }
  .demo-card {
    overflow: hidden;
  }
  .demo-header {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .demo-body {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    min-height: 320px;
  }
  .fake-video {
    background: #1a1a1e;
    height: 100%;
    min-height: 280px;
  }
  .right {
    padding: 1.5rem;
  }
  .right h3 { margin-bottom: 1rem; }
  .seg {
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
    line-height: 1.5;
  }
  .seg span {
    color: var(--accent);
    font-family: monospace;
    margin-right: 0.5rem;
    font-size: 0.8rem;
  }

  .section {
    padding: 5rem 0;
  }
  .section h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  .subtitle {
    text-align: center;
    color: var(--text-muted);
    margin-bottom: 2.5rem;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin-top: 2.5rem;
  }
  .step {
    padding: 1.75rem;
  }
  .num {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary);
    color: var(--primary-fg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    margin-bottom: 1rem;
  }
  .step h3 { margin-bottom: 0.5rem; }
  .step p { color: var(--text-muted); font-size: 0.95rem; }

  .usecases {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin-top: 2.5rem;
  }
  .use {
    padding: 1.75rem;
  }
  .use h3 { margin: 1rem 0 0.5rem; }
  .use p { color: var(--text-muted); font-size: 0.95rem; }

  .pricing {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    max-width: 720px;
    margin: 0 auto;
  }
  .price {
    padding: 2rem;
    position: relative;
  }
  .price.featured {
    border-color: var(--accent);
  }
  .badge {
    position: absolute;
    top: -12px;
    right: 1.5rem;
    background: var(--accent);
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
  }
  .amount {
    font-size: 2.5rem;
    font-weight: 800;
    margin: 0.5rem 0 1.25rem;
  }
  .amount span { font-size: 1rem; font-weight: 500; color: var(--text-muted); }
  .price ul {
    list-style: none;
    margin-bottom: 1.5rem;
  }
  .price li {
    padding: 0.35rem 0;
    font-size: 0.95rem;
  }

  @media (max-width: 768px) {
    .steps, .usecases, .pricing, .demo-body {
      grid-template-columns: 1fr;
    }
    .input-row { flex-direction: column; }
  }
</style>