<script lang="ts">
  import { goto } from '$app/navigation';
  import { createMeeting } from '$lib/api/client';

  let title = '';
  let meetingUrl = '';
  let loading = false;
  let error = '';

  async function handleSubmit() {
    error = '';
    loading = true;
    try {
      const meeting = await createMeeting({
        title: title || 'Untitled Meeting',
        meeting_url: meetingUrl
      });
      goto(`/meetings/${meeting.id}`);
    } catch (e: any) {
      error = e.message || 'Failed to create meeting';
    } finally {
      loading = false;
    }
  }
</script>

<div class="form-container">
  <h1>Join / Schedule Meeting</h1>
  <p class="subtitle">Paste a Google Meet URL and deploy the Spectrum bot.</p>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <label for="title">Meeting Title (optional)</label>
    <input
      id="title"
      type="text"
      bind:value={title}
      placeholder="e.g. Q4 Strategy Review"
    />

    <label for="url">Google Meet URL *</label>
    <input
      id="url"
      type="url"
      bind:value={meetingUrl}
      placeholder="https://meet.google.com/xyz-abc-def"
      required
    />

    <button type="submit" class="btn primary" disabled={loading}>
      {loading ? 'Starting bot…' : 'Send Bot to Meeting'}
    </button>
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
  label {
    display: block;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
    color: #94a3b8;
  }
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
  .btn.primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .error {
    background: #7f1d1d;
    color: #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
</style>