import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { UserPreferences } from '$lib/types';
import { DEFAULT_PREFERENCES } from '$lib/types';

const STORAGE_KEY = 'spectra_user_preferences';

function loadFromStorage(): UserPreferences {
  if (!browser) return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function saveToStorage(prefs: UserPreferences) {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function createPreferencesStore() {
  const { subscribe, set, update } = writable<UserPreferences>(loadFromStorage());

  return {
    subscribe,
    set(prefs: UserPreferences) {
      saveToStorage(prefs);
      set(prefs);
    },
    update(fn: (p: UserPreferences) => UserPreferences) {
      update((current) => {
        const next = fn(current);
        saveToStorage(next);
        return next;
      });
    },
    reset() {
      const defaults = { ...DEFAULT_PREFERENCES };
      saveToStorage(defaults);
      set(defaults);
    },
    init() {
      set(loadFromStorage());
    }
  };
}

export const preferences = createPreferencesStore();