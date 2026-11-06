<script lang="ts">
  import { goto } from '$app/navigation';
  import { onboarding } from '$lib/stores/onboarding';

  let email = '';
  let password = '';

  function handleLogin() {
    const addr = email.trim();
    if (addr !== $onboarding.profile.email) {
      const local = addr.split('@')[0] ?? '';
      const name = local.split(/[._-]/)[0] ?? local;
      onboarding.patch({ profile: { name: name.charAt(0).toUpperCase() + name.slice(1), email: addr } });
    }
    goto('/home');
  }
</script>

<div class="auth-wrapper">
  <div class="auth-card card">
    <h2>Welcome back</h2>
    <p class="subtitle">Log in to your Spectra account</p>

    <form on:submit|preventDefault={handleLogin}>
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required placeholder="you@company.com" />

      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} required placeholder="••••••••" />

      <button type="submit" class="btn btn-primary full">Sign In</button>
    </form>

    <p class="footer-link">
      Don't have an account? <a href="/register">Sign up</a>
    </p>
  </div>
</div>

<style>
  .auth-wrapper {
    min-height: calc(100vh - 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    padding: 2.5rem;
  }

  h2 {
    margin: 0 0 0.35rem;
    font-size: 1.75rem;
    font-weight: 700;
    text-align: center;
  }

  .subtitle {
    text-align: center;
    color: var(--text-muted);
    margin-bottom: 2rem;
    font-size: 0.95rem;
  }

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.4rem;
  }

  input {
    width: 100%;
    padding: 0.85rem 1rem;
    margin-bottom: 1.1rem;
    background: var(--bg-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    font-size: 0.95rem;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .full {
    width: 100%;
    margin-top: 0.5rem;
  }

  .footer-link {
    text-align: center;
    margin-top: 1.5rem;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .footer-link a {
    color: var(--accent);
    font-weight: 600;
  }

  .footer-link a:hover {
    text-decoration: underline;
  }
</style>