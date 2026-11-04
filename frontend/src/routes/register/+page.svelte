<script lang="ts">
  let name = '';
  let email = '';
  let password = '';

  function handleRegister() {
    console.log('Register attempt:', { name, email });
  }
</script>

<div class="auth-wrapper">
  <div class="auth-card card">
    <h2>Create your account</h2>
    <p class="subtitle">Start capturing meetings with Spectra</p>

    <form on:submit|preventDefault={handleRegister}>
      <label for="name">Full Name</label>
      <input id="name" type="text" bind:value={name} required placeholder="Your name" />

      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required placeholder="you@company.com" />

      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} required placeholder="••••••••" />

      <button type="submit" class="btn btn-primary full">Sign Up</button>
    </form>

    <p class="footer-link">
      Already have an account? <a href="/login">Log in</a>
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