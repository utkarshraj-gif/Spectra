<script lang="ts">
  import { goto } from '$app/navigation';
  import { ArrowRight } from 'lucide-svelte';
  import OnboardingFrame from '$lib/components/onboarding/OnboardingFrame.svelte';
  import TasksVisual from '$lib/components/onboarding/visuals/TasksVisual.svelte';
  import { onboarding, profile, teamFromEmail, TEAM_PREVIEW } from '$lib/stores/onboarding';
  import { toast } from '$lib/stores/toast';

  const AVATAR_COLORS = ['#e0177a', '#3fd36b', '#9013fe'];

  $: team = teamFromEmail($profile.email);
  $: memberLine = `${TEAM_PREVIEW.members.join(', ')} and ${TEAM_PREVIEW.others} others`;

  function choose(choice: 'joined' | 'skipped') {
    onboarding.patch({ team: choice });
    if (choice === 'joined') toast.success(`You joined ${team.name}`);
    goto('/onboarding/settings');
  }
</script>

<svelte:head><title>Join your team · Spectra</title></svelte:head>

<OnboardingFrame progress={75} backHref="/onboarding/tools">
  <h1 class="ob-title">We found your team on Spectra</h1>
  <p class="ob-sub">Join to collaborate with your teammates and easily share meetings and transcripts.</p>

  <button class="team" on:click={() => choose('joined')} title="Join {team.name}">
    <span class="team-avatar">{TEAM_PREVIEW.members[0][0]}</span>
    <span class="team-info">
      <span class="team-name">{team.name}</span>
      <span class="team-members">{memberLine}</span>
    </span>
    <span class="join">Join <ArrowRight size={13} /></span>
    <span class="stack">
      {#each TEAM_PREVIEW.members.slice(1) as m, i}
        <span style="background:{AVATAR_COLORS[i]}">{m[0]}</span>
      {/each}
      <span style="background:{AVATAR_COLORS[2]}">{TEAM_PREVIEW.others + 1}</span>
    </span>
  </button>

  <button class="ob-secondary not-now" on:click={() => choose('skipped')}>Not now</button>

  <TasksVisual slot="visual" />
</OnboardingFrame>

<style>
  .team {
    margin-top: 26px;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 6px;
    border: 1px solid #1f1f23;
    background: #19191c;
    text-align: left;
    font-family: inherit;
    transition: border-color 0.12s;
  }
  .team:hover {
    border-color: #9013fe;
  }
  .team-avatar {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #e0177a;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .team-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .team-name {
    font-size: 13.5px;
    font-weight: 600;
    color: #f2f2f2;
  }
  .team-members {
    font-size: 12px;
    color: #9a9aa0;
  }
  .join {
    display: none;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    color: #c895ff;
  }
  .team:hover .join {
    display: flex;
  }
  .stack {
    display: flex;
  }
  .stack span {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #19191c;
    margin-left: -5px;
    color: #fff;
    font-size: 8.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .not-now {
    margin-top: 14px;
  }
</style>
