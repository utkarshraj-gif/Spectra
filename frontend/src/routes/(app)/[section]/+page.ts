import { error } from '@sveltejs/kit';
import { SECTIONS } from '$lib/components/app/nav';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  if (!(params.section in SECTIONS)) throw error(404, 'Page not found');
  return { section: params.section };
};
