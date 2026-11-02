<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
</script>

<footer class="footer">
  <div class="container">
    <div class="top">
      <div class="brand">
        <Sparkles size={20} />
        <span>Spectra</span>
      </div>
      <div class="cols">
        <div>
          <h4>Product</h4>
          <a href="/#how">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/dashboard">Dashboard</a>
        </div>
        <div>
          <h4>Company</h4>
          <a href="#">About</a>
          <a href="#">Blog</a>
          <a href="#">Contact</a>
        </div>
        <div>
          <h4>Legal</h4>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>
    </div>
    <div class="bottom">
      <p>© 2026 Spectra. All rights reserved.</p>
    </div>
  </div>
</footer>

<style>
  .footer {
    margin-top: 6rem;
    border-top: 1px solid var(--border);
    padding: 3rem 0 2rem;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 3rem;
    margin-bottom: 2.5rem;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.15rem;
  }
  .cols {
    display: flex;
    gap: 4rem;
  }
  .cols h4 {
    font-size: 0.85rem;
    margin-bottom: 0.75rem;
    color: var(--text-muted);
  }
  .cols a {
    display: block;
    font-size: 0.9rem;
    margin-bottom: 0.4rem;
    color: var(--text);
  }
  .cols a:hover { opacity: 0.7; }
  .bottom {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  @media (max-width: 768px) {
    .top { flex-direction: column; }
    .cols { gap: 2rem; }
  }
</style>