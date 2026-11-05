import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

function createToastStore() {
  const { subscribe, update } = writable<ToastItem[]>([]);
  let seq = 0;

  function push(kind: ToastKind, message: string, ms = 3200) {
    const id = ++seq;
    update((list) => [...list, { id, kind, message }]);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        update((list) => list.filter((t) => t.id !== id));
      }, ms);
    }
  }

  return {
    subscribe,
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    info: (msg: string) => push('info', msg),
    dismiss: (id: number) => update((list) => list.filter((t) => t.id !== id))
  };
}

export const toast = createToastStore();