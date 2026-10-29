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
  .settings-container { max-width: 650px; margin: 2rem auto; }
  .settings-card {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 2rem;
    border-radius: 12px;
  }
  h1 { margin-bottom: 1.5rem; }
  h2 { margin-top: 0; margin-bottom: 1.25rem; font-size: 1.25rem; }
  label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: #94a3b8; }
  input[type="text"], select {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1.25rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: white;
    box-sizing: border-box;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .toggle-row label {
    margin-bottom: 0;
    color: #e2e8f0;
  }
</style>
