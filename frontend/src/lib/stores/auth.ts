import { writable } from 'svelte/store';
import type { User } from '$lib/types';

export const authUser = writable<User | null>(null);
export const authToken = writable<string | null>(null);
