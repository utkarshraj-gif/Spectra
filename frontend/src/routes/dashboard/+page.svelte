<script lang="ts">
  const recentMeetings = [
    { id: '1', title: 'Product Sync & Sprint Planning', date: 'Oct 29, 2026', duration: '45m', status: 'Completed' },
    { id: '2', title: 'Architecture Review: Spectrum AI', date: 'Oct 28, 2026', duration: '30m', status: 'Processing' }
  ];
</script>

<div class="dashboard">
  <div class="header">
    <h1>Dashboard</h1>
    <a href="/meetings/new" class="btn primary">+ New Meeting</a>
  </div>

  <section class="section">
    <h2>Recent Meetings</h2>
    <div class="card-list">
      {#each recentMeetings as meeting}
        <a href={`/meetings/${meeting.id}`} class="meeting-card">
          <div class="info">
            <h3>{meeting.title}</h3>
            <p>{meeting.date} • {meeting.duration}</p>
          </div>
          <span class="badge {meeting.status.toLowerCase()}">{meeting.status}</span>
        </a>
      {/each}
    </div>
  </section>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  .btn.primary {
    background: #3b82f6;
    color: white;
    text-decoration: none;
    padding: 0.75rem 1.25rem;
    border-radius: 6px;
    font-weight: 600;
  }
  .meeting-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1e293b;
    border: 1px solid #334155;
    padding: 1.25rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    text-decoration: none;
    color: inherit;
  }
  .meeting-card:hover {
    border-color: #60a5fa;
  }
  h3 { margin: 0 0 0.25rem 0; font-size: 1.1rem; }
  p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge.completed { background: #065f46; color: #34d399; }
  .badge.processing { background: #854d0e; color: #fde047; }
</style>
