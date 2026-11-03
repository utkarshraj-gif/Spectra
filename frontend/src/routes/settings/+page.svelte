<script lang="ts">
  let botName = 'Spectrum Bot';
  let autoJoinCalendar = true;
  let defaultLanguage = 'en';
</script>

<div class="settings-container">
  <h1>Settings</h1>

  <section class="settings-card">
    <h2>Meeting Bot Preferences</h2>
    <label for="bot-name">Default Bot Name</label>
    <input id="bot-name" type="text" bind:value={botName} />

    <div class="toggle-row">
      <input id="calendar-sync" type="checkbox" bind:checked={autoJoinCalendar} />
      <label for="calendar-sync">Automatically join scheduled Google/Outlook meetings</label>
    </div>

    <label for="lang">Transcription Language</label>
    <select id="lang" bind:value={defaultLanguage}>
      <option value="en">English (Default)</option>
      <option value="es">Spanish</option>
      <option value="de">German</option>
      <option value="fr">French</option>
    </select>
  </section>
</div>

<style>
  .settings-container {
    max-width: 650px;
    margin: 2.5rem auto;
  }
  .settings-card {
    background: var(--bg-elevated, #ffffff);
    border: 1px solid var(--border, #e2e2e8);
    box-shadow: var(--card-shadow, 0 4px 24px rgba(0, 0, 0, 0.06));
    padding: 2.5rem;
    border-radius: 16px;
    color: var(--text, #131316);
  }
  h1 {
    margin-bottom: 1.5rem;
    color: var(--text, #131316);
  }
  h2 {
    margin-top: 0;
    margin-bottom: 1.25rem;
    font-size: 1.25rem;
    color: var(--text, #131316);
  }
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text, #131316);
  }
  input[type="text"], select {
    width: 100%;
    padding: 0.85rem 1rem;
    margin-bottom: 1.25rem;
    background: var(--bg-muted, #f8fafc);
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 8px;
    color: var(--text, #131316);
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  input[type="text"]:focus, select:focus {
    outline: none;
    border-color: #3b82f6;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    color: var(--text, #131316);
  }
  .toggle-row label {
    margin-bottom: 0;
    color: var(--text, #131316);
  }
</style>
