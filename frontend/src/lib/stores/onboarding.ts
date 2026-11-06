import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type JoinMode = 'all' | 'owned' | 'manual';
export type RecapMode = 'everyone' | 'me' | 'team';

export interface Profile {
  name: string;
  email: string;
}

export interface OnboardingState {
  profile: Profile;
  role: string;
  title: string;
  tools: string[];
  team: 'joined' | 'skipped' | null;
  unlimitedTranscripts: boolean;
  joinMode: JoinMode;
  recapMode: RecapMode;
  language: string;
  source: string;
  zoom: 'connected' | 'skipped' | null;
  /** Full-screen setup pages (role → tools → team → settings) finished. */
  setupDone: boolean;
  /** Welcome modal on the home page (language → source → zoom) finished. */
  welcomeDone: boolean;
}

const STORAGE_KEY = 'spectra_onboarding';

export const DEFAULT_PROFILE: Profile = {
  name: 'Mahi',
  email: 'mahi.singhal@evocs.tech'
};

const DEFAULT_STATE: OnboardingState = {
  profile: { ...DEFAULT_PROFILE },
  role: 'Engineering',
  title: 'Software Engineer / Software Developer',
  tools: [],
  team: null,
  unlimitedTranscripts: true,
  joinMode: 'all',
  recapMode: 'everyone',
  language: 'en-global',
  source: '',
  zoom: null,
  setupDone: false,
  welcomeDone: false
};

function load(): OnboardingState {
  if (!browser) return structuredClone(DEFAULT_STATE);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function createOnboardingStore() {
  const { subscribe, set, update } = writable<OnboardingState>(load());

  function persist(state: OnboardingState) {
    if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  return {
    subscribe,
    init() {
      set(load());
    },
    patch(partial: Partial<OnboardingState>) {
      update((s) => {
        const next = { ...s, ...partial };
        persist(next);
        return next;
      });
    },
    /** Start a fresh onboarding run for a newly registered user. */
    start(profile: Profile) {
      const next = { ...structuredClone(DEFAULT_STATE), profile };
      persist(next);
      set(next);
    },
    reset() {
      const next = structuredClone(DEFAULT_STATE);
      persist(next);
      set(next);
    }
  };
}

export const onboarding = createOnboardingStore();

export const profile = derived(onboarding, ($o) => $o.profile);

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'there';
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    const n = parts[0];
    return (n[0] + (n[1] ?? '')).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Placeholder until the backend exposes workspace discovery by email domain. */
export const TEAM_PREVIEW = {
  members: ['Barbara', 'Kishan', 'Ameya'],
  others: 34
};

/** "mahi.singhal@evocs.tech" → { name: "Evocs.Tech", domain: "evocs.tech" } */
export function teamFromEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const name = domain
    .split('.')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join('.');
  return { name: name || 'Your Team', domain };
}

/** Falls back to the email local-part ("mahi.singhal" → "MS") when the name is a single word. */
export function avatarInitials(p: Profile) {
  const parts = p.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return initials(p.name);
  const local = p.email.split('@')[0] ?? '';
  const bits = local.split(/[._-]/).filter(Boolean);
  if (bits.length >= 2) return (bits[0][0] + bits[1][0]).toUpperCase();
  return initials(p.name);
}
