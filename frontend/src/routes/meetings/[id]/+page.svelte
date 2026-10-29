<script lang="ts">
  import { page } from '$app/stores';

  $: meetingId = $page.params.id;
</script>

<div class="meeting-detail">
  <div class="header">
    <a href="/dashboard" class="back-link">← Back to Dashboard</a>
    <h1>Meeting #{meetingId}</h1>
  </div>

  <div class="grid">
    <div class="main-panel">
      <h2>Transcript</h2>
      <div class="transcript-box">
        <p><strong>00:01 - Alex:</strong> Welcome everyone to the architecture review for Spectrum AI.</p>
        <p><strong>00:15 - Jordan:</strong> Thanks Alex. We're going with SvelteKit for the frontend and Go for high-throughput APIs.</p>
        <p><strong>00:40 - Taylor:</strong> And the AI and transcription pipeline will use uv for Python dependency management.</p>
      </div>
    </div>

    <div class="side-panel">
      <h2>AI Summary & Actions</h2>
      <div class="summary-box">
        <h3>Key Takeaways</h3>
        <ul>
          <li>Go backend handles auth, routing, and meeting state.</li>
          <li>SvelteKit provides fast, reactive UI.</li>
          <li>Python service handles transcription and LLM processing via uv.</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<style>
  .back-link { color: #60a5fa; text-decoration: none; font-size: 0.875rem; }
  .header { margin-bottom: 2rem; }
  h1 { margin-top: 0.5rem; }
  .grid {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 1.5rem;
  }
  @media (max-width: 768px) {
    .grid { grid-template-columns: 1fr; }
  }
  .main-panel, .side-panel {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 1.5rem;
  }
  .transcript-box {
    background: #0f172a;
    border-radius: 6px;
    padding: 1rem;
    line-height: 1.6;
  }
  .summary-box {
    background: #0f172a;
    border-radius: 6px;
    padding: 1rem;
  }
  ul { padding-left: 1.25rem; color: #cbd5e1; }
  li { margin-bottom: 0.5rem; }
</style>
