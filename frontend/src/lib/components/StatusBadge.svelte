<script lang="ts">
  import type { MeetingStatus } from '$lib/types';

  export let status: MeetingStatus;

  const labelMap: Record<string, string> = {
    queued: 'Queued',
    starting: 'Starting',
    waiting_for_admission: 'Waiting for admission',
    joined: 'Joined',
    recording: 'Recording',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    scheduled: 'Scheduled',
    in_progress: 'In Progress'
  };
</script>

<span class="badge {status}">
  {labelMap[status] || status}
</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  .queued, .scheduled { background: #334155; color: #cbd5e1; }
  .starting { background: #1e3a8a; color: #93c5fd; }
  .waiting_for_admission { background: #854d0e; color: #fde047; }
  .joined, .recording, .in_progress { background: #065f46; color: #34d399; }
  .processing { background: #5b21b6; color: #c4b5fd; }
  .completed { background: #065f46; color: #34d399; }
  .failed { background: #7f1d1d; color: #fca5a5; }
  .cancelled { background: #374151; color: #9ca3af; }
</style>