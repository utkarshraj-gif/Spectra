<script lang="ts">
  let email = '';
  let password = '';

  function handleLogin() {
    console.log('Login attempt:', email);
  }
</script>

<div class="auth-card">
  <h2>Login to Spectrum AI</h2>
  <form on:submit|preventDefault={handleLogin}>
    <label for="email">Email</label>
    <input id="email" type="email" bind:value={email} required placeholder="you@company.com" />

    <label for="password">Password</label>
    <input id="password" type="password" bind:value={password} required placeholder="••••••••" />

    <button type="submit" class="btn">Sign In</button>
  </form>
  <p class="footer-link">Don't have an account? <a href="/register">Register</a></p>
</div>

<style>
  .auth-card {
    max-width: 400px;
    margin: 3rem auto;
    background: #1e293b;
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid #334155;
  }
  h2 { margin-top: 0; margin-bottom: 1.5rem; text-align: center; }
  label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; color: #94a3b8; }
  input {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    color: white;
    box-sizing: border-box;
  }
  .btn {
    width: 100%;
    padding: 0.75rem;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .footer-link { text-align: center; margin-top: 1rem; font-size: 0.875rem; color: #94a3b8; }
  a { color: #60a5fa; }
</style>
