<script lang="ts">
  import { onMount } from 'svelte';
  import { preferences } from '$lib/stores/preferences';
  import { toast } from '$lib/stores/toast';
  import {
    fetchPreferences,
    savePreferencesApi,
    getGoogleConnectUrl
  } from '$lib/api/client';
  import type { UserPreferences } from '$lib/types';
  import { Bot, Link2, AlertCircle, Save } from 'lucide-svelte';

  let form: UserPreferences;
  let saving = false;

  onMount(async () => {
    preferences.init();
    form = { ...$preferences };

    const remote = await fetchPreferences();
    if (remote) {
      preferences.set({ ...$preferences, ...remote });
      form = { ...$preferences };
    }
  });

  // Keep a working form object even before onMount
  $: if (!form) form = { ...$preferences };

  async function handleSave() {
    saving = true;
    try {
      preferences.set({ ...form });
      const ok = await savePreferencesApi(form);
      if (ok) {
        toast.success('Settings saved to server');
      } else {
        toast.success('Settings saved on this device');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save settings');
    } finally {
      saving = false;
    }
  }

  function handleReset() {
    preferences.reset();
    form = { ...$preferences };
    toast.info('Settings reset to defaults');
  }
</script>

<div class="settings-page">
  <h1>Settings</h1>
  <p class="subtitle">Bot defaults, language, and connected accounts</p>

  <section class="card block">
    <div class="section-head">
      <Bot size={18} />
      <h2>Meeting Bot Preferences</h2>
    </div>

    <label for="bot-name">Default Bot Name</label>
    <input
      id="bot-name"
      type="text"
      bind:value={form.bot_name}
      placeholder="Spectra Assistant"
    />

    <label for="lang">Preferred Transcription Language</label>
    <select id="lang" bind:value={form.transcription_language}>
      <option value="en">English</option>
      <option value="hi">Hindi</option>
      <option value="es">Spanish</option>
      <option value="de">German</option>
      <option value="fr">French</option>
      <option value="pt">Portuguese</option>
    </select>

    <div class="toggle-row">
      <input id="auto-join" type="checkbox" bind:checked={form.auto_join_calendar} />
      <label for="auto-join">Default Auto-Join for calendar meetings</label>
    </div>

    <div class="toggle-row">
      <input id="notify" type="checkbox" bind:checked={form.notify_on_complete} />
      <label for="notify">Notify when transcription is complete</label>
    </div>

    <div class="actions">
      <button type="button" class="btn btn-primary" disabled={saving} on:click={handleSave}>
        <Save size={16} />
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      <button type="button" class="btn btn-outline" on:click={handleReset}>
        Reset defaults
      </button>
    </div>
  </section>

  <section class="card block">
    <div class="section-head">
      <Link2 size={18} />
      <h2>Connected Accounts</h2>
    </div>

    <div class="account-row">
      <div class="account-info">
        <strong>Google Calendar</strong>
        <p>Connect Google to sync upcoming Meet events and use Bot Auto-Join on the dashboard.</p>
      </div>
      <a class="btn btn-outline" href={getGoogleConnectUrl()}>Connect Google</a>
    </div>

    <div class="account-row">
      <div class="account-info">
        <strong>Microsoft 365</strong>
        <p>Outlook calendar sync — coming soon</p>
      </div>
      <span class="pill muted"><AlertCircle size={14} /> Not available</span>
    </div>
  </section>
</div>

<style>
  .settings-page {
    max-width: 640px;
    margin: 0 auto;
    padding-bottom: 3rem;
  }
  h1 {
    margin: 0 0 0.35rem;
    font-size: 1.75rem;
  }
  .subtitle {
    color: var(--text-muted);
    margin: 0 0 1.75rem;
    font-size: 0.95rem;
  }
  .block {
    padding: 1.75rem;
    margin-bottom: 1.25rem;
  }
  .section-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .section-head h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  input[type='text'],
  select {
    width: 100%;
    padding: 0.8rem 1rem;
    margin-bottom: 1.1rem;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    box-sizing: border-box;
    font-size: 0.95rem;
  }
  input:focus,
  select:focus {
    outline: none;
    border-color: var(--accent);
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    margin-bottom: 1rem;
  }
  .toggle-row label {
    margin: 0;
    font-weight: 500;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1.25rem;
  }
  .actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .account-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border);
  }
  .account-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .account-info strong {
    display: block;
    margin-bottom: 0.2rem;
  }
  .account-info p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .pill.muted {
    background: var(--bg-muted);
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  @media (max-width: 560px) {
    .account-row {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>