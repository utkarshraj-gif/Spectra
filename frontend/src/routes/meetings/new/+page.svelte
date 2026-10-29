<script lang="ts">
  let title = '';
  let meetingUrl = '';
  let botName = 'Spectrum Bot';

  function scheduleMeeting() {
    console.log('Scheduling meeting bot:', { title, meetingUrl, botName });
  }
</script>

<div class="form-container">
  <h1>Join / Schedule Meeting</h1>
  <p class="subtitle">Deploy the Spectrum AI bot to record, transcribe, and summarize your meeting.</p>

  <form on:submit|preventDefault={scheduleMeeting}>
    <label for="title">Meeting Title</label>
    <input id="title" type="text" bind:value={title} placeholder="e.g. Q4 Strategy Review" required />

    <label for="url">Meeting URL (Google Meet, Zoom, Teams)</label>
    <input id="url" type="url" bind:value={meetingUrl} placeholder="https://meet.google.com/xyz-abc" required />

    <label for="bot">Bot Display Name</label>
    <input id="bot" type="text" bind:value={botName} />

    <button type="submit" class="btn primary">Send Bot to Meeting</button>
  </form>
</div>

<style>
  .form-container {
    max-width: 600px;
    margin: 2rem auto;
    background: #1e293b;
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid #334155;
  }
  h1 { margin-top: 0; margin-bottom: 0.5rem; }
  .subtitle { color: #94a3b8; margin-bottom: 2rem; }
  label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: #94a3b8; }
  input {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1.25rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: white;
    box-sizing: border-box;
  }
  .btn.primary {
    width: 100%;
    padding: 0.85rem;
    background: #3b82f6;
    color: white;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
