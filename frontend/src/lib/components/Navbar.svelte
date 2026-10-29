<script lang="ts">
  import { authUser } from '$lib/stores/auth';
</script>

<nav class="navbar">
  <div class="brand">
    <a href="/" class="logo">Spectrum AI</a>
  </div>
  <div class="nav-links">
    {#if $authUser}
      <a href="/dashboard">Dashboard</a>
      <a href="/meetings/new">New Meeting</a>
      <a href="/settings">Settings</a>
      <button class="logout-btn" on:click={() => authUser.set(null)}>Logout</button>
    {:else}
      <a href="/dashboard">Dashboard</a>
      <a href="/login">Login</a>
      <a href="/register" class="register-pill">Register</a>
    {/if}
  </div>
</nav>

<style>
  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
  }
  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: #60a5fa;
    text-decoration: none;
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  .nav-links a {
    color: #94a3b8;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
  }
  .nav-links a:hover {
    color: #f1f5f9;
  }
  .register-pill {
    background: #3b82f6;
    color: white !important;
    padding: 0.4rem 0.9rem;
    border-radius: 6px;
  }
  .logout-btn {
    background: transparent;
    border: 1px solid #334155;
    color: #cbd5e1;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
