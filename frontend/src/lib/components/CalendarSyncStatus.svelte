<script lang="ts">
  import type { CalendarSyncState } from '$lib/types';
  import { getGoogleConnectUrl } from '$lib/api/client';
  import { Link2, AlertCircle, CheckCircle2 } from 'lucide-svelte';

  export let state: CalendarSyncState = 'loading';
  export let message = '';
</script>

<div class="card status" class:ok={state === 'connected'} class:warn={state === 'unauthorized' || state === 'not_configured'}>
  <div class="row">
    {#if state === 'connected'}
      <CheckCircle2 size={18} />
      <div>
        <strong>Google Calendar connected</strong>
        <p>Upcoming events with Meet links are shown below.</p>
      </div>
    {:else if state === 'loading'}
      <Link2 size={18} />
      <div>
        <strong>Checking calendar sync…</strong>
      </div>
    {:else}
      <AlertCircle size={18} />
      <div>
        <strong>
          {#if state === 'not_configured'}
            Calendar not configured
          {:else if state === 'unauthorized'}
            Connect Google Calendar
          {:else}
            Calendar error
          {/if}
        </strong>
        <p>{message || 'Connect your account to see upcoming meetings.'}</p>
      </div>
    {/if}
  </div>

  {#if state === 'unauthorized' || state === 'not_configured'}
    <a class="btn btn-outline" href={getGoogleConnectUrl()}>
      Connect Google
    </a>
  {/if}
</div>

<style>
  .status {
    padding: 1.1rem 1.25rem;
    margin-bottom: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }
  .row strong {
    display: block;
    margin-bottom: 0.15rem;
  }
  .row p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }
  .ok {
    border-color: #065f46;
  }
  .warn {
    border-color: #854d0e;
  }
</style>