import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
  const stored = browser ? (localStorage.getItem('theme') as Theme) : 'light';
  const { subscribe, set, update } = writable<Theme>(stored || 'light');

  return {
    subscribe,
    toggle: () =>
      update((t) => {
        const next = t === 'light' ? 'dark' : 'light';
        if (browser) {
          localStorage.setItem('theme', next);
          document.documentElement.setAttribute('data-theme', next);
        }
        return next;
      }),
    set: (value: Theme) => {
      if (browser) {
        localStorage.setItem('theme', value);
        document.documentElement.setAttribute('data-theme', value);
      }
      set(value);
    },
    init: () => {
      if (browser) {
        const t = (localStorage.getItem('theme') as Theme) || 'light';
        document.documentElement.setAttribute('data-theme', t);
        set(t);
      }
    }
  };
}

export const theme = createThemeStore();