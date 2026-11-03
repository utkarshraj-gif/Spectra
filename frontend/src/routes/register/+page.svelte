<script lang="ts">
  let name = '';
  let email = '';
  let password = '';

  function handleRegister() {
    console.log('Register attempt:', { name, email });
  }
</script>

<div class="auth-card">
  <h2>Create your account</h2>
  <form on:submit|preventDefault={handleRegister}>
    <label for="name">Full Name</label>
    <input id="name" type="text" bind:value={name} required placeholder="Jane Doe" />

    <label for="email">Email</label>
    <input id="email" type="email" bind:value={email} required placeholder="you@company.com" />

    <label for="password">Password</label>
    <input id="password" type="password" bind:value={password} required placeholder="••••••••" />

    <button type="submit" class="btn">Register</button>
  </form>
  <p class="footer-link">Already registered? <a href="/login">Login</a></p>
</div>

<style>
  .auth-card {
    max-width: 400px;
    margin: 3rem auto;
    background: var(--bg-elevated, #ffffff);
    color: var(--text, #131316);
    padding: 2.5rem;
    border-radius: 16px;
    border: 1px solid var(--border, #e2e2e8);
    box-shadow: var(--card-shadow, 0 4px 24px rgba(0, 0, 0, 0.06));
  }
  h2 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    text-align: center;
    color: var(--text, #131316);
    font-weight: 700;
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
    margin-bottom: 1rem;
    background: var(--bg-muted, #f8fafc);
    border: 1px solid var(--border, #cbd5e1);
    border-radius: 8px;
    color: var(--text, #131316);
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  input:focus {
    outline: none;
    border-color: #3b82f6;
  }
  .btn {
    width: 100%;
    padding: 0.85rem;
    background: #2563eb;
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn:hover {
    background: #1d4ed8;
  }
  .footer-link {
    text-align: center;
    margin-top: 1.25rem;
    font-size: 0.875rem;
    color: var(--text-muted, #6b6b76);
  }
  a {
    color: #2563eb;
    font-weight: 500;
  }
</style>
