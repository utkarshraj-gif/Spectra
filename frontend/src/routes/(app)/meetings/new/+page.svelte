<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { createMeeting } from '$lib/api/client';

  let title = '';
  let meetingUrl = '';
  let loading = false;
  let error = '';

  onMount(() => {
    const urlParam = $page.url.searchParams.get('url');
    if (urlParam) {
      meetingUrl = urlParam;
    }
  });

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
  <p class="subtitle">Paste a Google Meet, Zoom, or Teams URL and deploy the Spectrum bot.</p>

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

    <label for="url">Meeting URL *</label>
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
    margin: 2.5rem auto;
    background: var(--bg-elevated, #ffffff);
    color: var(--text, #131316);
    padding: 2.5rem;
    border-radius: 16px;
    border: 1px solid var(--border, #e2e2e8);
    box-shadow: var(--card-shadow, 0 4px 24px rgba(0, 0, 0, 0.06));
  }
  h1 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    color: var(--text, #131316);
    font-size: 1.75rem;
    font-weight: 700;
  }
  .subtitle {
    color: var(--text-muted, #6b6b76);
    margin-bottom: 2rem;
    font-size: 0.95rem;
    line-height: 1.5;
  }
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text, #131316);
  }
  input {
    width: 100%;
    padding: 0.85rem 1rem;
    margin-bottom: 1.25rem;
    background: var(--bg-muted, #f8fafc);
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 8px;
    color: var(--text, #131316);
    font-size: 0.95rem;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }
  input::placeholder {
    color: var(--text-muted, #94a3b8);
  }
  .btn.primary {
    width: 100%;
    padding: 0.9rem;
    background: #2563eb;
    color: white;
    font-weight: 600;
    font-size: 1rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn.primary:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .btn.primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .error {
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
  }
</style>
