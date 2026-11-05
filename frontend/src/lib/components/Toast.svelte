<script lang="ts">
  import { toast } from '$lib/stores/toast';
  import { X } from 'lucide-svelte';
</script>

<div class="toast-host" aria-live="polite">
  {#each $toast as t (t.id)}
    <div class="toast {t.kind}">
      <span>{t.message}</span>
      <button type="button" class="close" on:click={() => toast.dismiss(t.id)} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-host {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 360px;
  }
  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text);
    box-shadow: var(--card-shadow);
    font-size: 0.9rem;
  }
  .toast.success {
    border-color: #065f46;
  }
  .toast.error {
    border-color: #7f1d1d;
    background: #7f1d1d;
    color: #fca5a5;
  }
  .toast.info {
    border-color: var(--accent);
  }
  .close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    display: flex;
    opacity: 0.8;
  }
</style>