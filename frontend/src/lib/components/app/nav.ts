import {
  House,
  Video,
  ListChecks,
  Sparkles,
  ChartNoAxesColumn,
  Bot,
  Zap,
  Layers,
  Settings,
  ListVideo,
  Users,
  Globe,
  Scale,
  Gift,
  Bell,
  MessageCircle
} from 'lucide-svelte';

export interface NavItem {
  label: string;
  href: string;
  icon: any;
  special?: 'ask' | 'upgrade';
}

export const NAV_GROUPS: NavItem[][] = [
  [
    { label: 'Home', href: '/home', icon: House },
    { label: 'AskSpectra', href: '/ask', icon: MessageCircle, special: 'ask' }
  ],
  [
    { label: 'Meetings', href: '/dashboard', icon: Video },
    { label: 'Tasks', href: '/tasks', icon: ListChecks },
    { label: 'AI Skills', href: '/ai-skills', icon: Sparkles }
  ],
  [
    { label: 'Analytics', href: '/analytics', icon: ChartNoAxesColumn },
    { label: 'Voice Agents', href: '/voice-agents', icon: Bot }
  ],
  [{ label: 'Upgrade', href: '/upgrade', icon: Zap, special: 'upgrade' }]
];

export const BOTTOM_NAV: NavItem[] = [
  { label: 'Integrations', href: '/integrations', icon: Layers },
  { label: 'Settings', href: '/settings', icon: Settings }
];

export interface SectionInfo {
  title: string;
  description: string;
  icon: any;
}

/** Pages reachable from the shell that don't have a dedicated implementation yet. */
export const SECTIONS: Record<string, SectionInfo> = {
  ask: {
    title: 'AskSpectra',
    description: 'Ask questions across all of your meetings and get answers with sources.',
    icon: MessageCircle
  },
  tasks: {
    title: 'Tasks',
    description: 'Every action item captured from your meetings, in one place.',
    icon: ListChecks
  },
  'ai-skills': {
    title: 'AI Skills',
    description: 'Reusable prompts that turn transcripts into notes, emails, and reports.',
    icon: Sparkles
  },
  analytics: {
    title: 'Analytics',
    description: 'Talk time, sentiment, and topic trends across your conversations.',
    icon: ChartNoAxesColumn
  },
  'voice-agents': {
    title: 'Voice Agents',
    description: 'AI agents that can join calls, ask questions, and take actions for you.',
    icon: Bot
  },
  upgrade: {
    title: 'Upgrade',
    description: 'Unlimited transcripts, more storage, and advanced AI features — now 40% off.',
    icon: Zap
  },
  integrations: {
    title: 'Integrations',
    description: 'Connect Zoom, Slack, Notion, Jira, Linear and more.',
    icon: Layers
  },
  playlist: {
    title: 'Playlist',
    description: 'Group meeting clips into shareable playlists.',
    icon: ListVideo
  },
  team: {
    title: 'My team',
    description: 'Invite teammates and manage who can see your meetings.',
    icon: Users
  },
  'web-logins': {
    title: 'Manage web logins',
    description: 'Sessions and devices where you are signed in to Spectra.',
    icon: Globe
  },
  'platform-rules': {
    title: 'Platform rules',
    description: 'Control which meetings the notetaker joins and who receives recaps.',
    icon: Scale
  },
  refer: {
    title: 'Refer and earn $5',
    description: 'Share Spectra with friends and earn credit for every signup.',
    icon: Gift
  },
  notifications: {
    title: 'Notifications',
    description: 'Updates about your meetings, recaps, and team activity.',
    icon: Bell
  }
};

export function titleForPath(path: string): string {
  if (path === '/home') return 'Home';
  if (path.startsWith('/dashboard')) return 'Meetings';
  if (path === '/meetings/new') return 'Capture Meeting';
  if (path.startsWith('/meetings/')) return 'Meeting';
  if (path.startsWith('/settings')) return 'Settings';
  const key = path.split('/')[1];
  return SECTIONS[key]?.title ?? 'Spectra';
}
