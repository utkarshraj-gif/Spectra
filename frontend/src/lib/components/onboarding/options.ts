import type { Brand } from '$lib/components/brand/BrandIcon.svelte';

export const ROLE_TITLES: Record<string, string[]> = {
  Engineering: [
    'Software Engineer / Software Developer',
    'Engineering Manager',
    'Technical Lead',
    'Head of Engineering / CTO',
    'Other'
  ],
  Product: ['Product Manager', 'Senior Product Manager', 'Product Owner', 'Head of Product / CPO', 'Other'],
  Design: ['Product Designer', 'UX Researcher', 'Design Manager', 'Head of Design', 'Other'],
  Sales: ['Account Executive', 'SDR / BDR', 'Sales Manager', 'Head of Sales / CRO', 'Other'],
  Marketing: ['Marketing Manager', 'Growth Marketer', 'Product Marketer', 'Head of Marketing / CMO', 'Other'],
  'Customer Success': ['Customer Success Manager', 'Support Specialist', 'Account Manager', 'Head of Customer Success', 'Other'],
  'Recruiting / HR': ['Recruiter', 'HR Business Partner', 'Talent Acquisition Lead', 'Head of People', 'Other'],
  Operations: ['Operations Manager', 'Project Manager', 'Business Analyst', 'COO / Head of Operations', 'Other'],
  'Founder / Executive': ['Founder / Co-founder', 'CEO', 'Executive', 'Other'],
  Education: ['Student', 'Teacher / Professor', 'Researcher', 'Other'],
  Consulting: ['Consultant', 'Manager', 'Partner', 'Other'],
  Other: ['Other']
};

export const TOOLS: { id: string; label: string; brand: Brand | null }[] = [
  { id: 'jira', label: 'Jira Projects', brand: 'jira' },
  { id: 'linear', label: 'Linear App', brand: 'linear' },
  { id: 'confluence', label: 'Confluence', brand: 'confluence' },
  { id: 'notion', label: 'Notion', brand: 'notion' },
  { id: 'slack', label: 'Slack', brand: 'slack' },
  { id: 'asana', label: 'Asana', brand: 'asana' },
  { id: 'zapier', label: 'Zapier', brand: 'zapier' },
  { id: 'other', label: 'Other', brand: null }
];

export const SOURCES = [
  'Podcast',
  'Coworker/Friend',
  'Newsletter',
  'In a meeting',
  'Blog/Article',
  'Google Search',
  'Billboard',
  'AI Search',
  'Social Media',
  'Other'
];

/** `code` is what the transcription service receives; `auto` lets it detect the language. */
export const LANGUAGES: { id: string; label: string; code: string }[] = [
  { id: 'en-global', label: 'English (Global)', code: 'en' },
  { id: 'en-us', label: 'English (US)', code: 'en' },
  { id: 'en-gb', label: 'English (UK)', code: 'en' },
  { id: 'en-in', label: 'English (India)', code: 'en' },
  { id: 'auto', label: 'Auto-detect (multi-language)', code: 'auto' },
  { id: 'hi', label: 'Hindi', code: 'hi' },
  { id: 'es', label: 'Spanish', code: 'es' },
  { id: 'fr', label: 'French', code: 'fr' },
  { id: 'de', label: 'German', code: 'de' },
  { id: 'pt', label: 'Portuguese', code: 'pt' },
  { id: 'it', label: 'Italian', code: 'it' },
  { id: 'nl', label: 'Dutch', code: 'nl' },
  { id: 'pl', label: 'Polish', code: 'pl' },
  { id: 'ru', label: 'Russian', code: 'ru' },
  { id: 'tr', label: 'Turkish', code: 'tr' },
  { id: 'ar', label: 'Arabic', code: 'ar' },
  { id: 'ja', label: 'Japanese', code: 'ja' },
  { id: 'ko', label: 'Korean', code: 'ko' },
  { id: 'zh', label: 'Chinese (Mandarin)', code: 'zh' },
  { id: 'bn', label: 'Bengali', code: 'bn' },
  { id: 'ta', label: 'Tamil', code: 'ta' },
  { id: 'te', label: 'Telugu', code: 'te' },
  { id: 'mr', label: 'Marathi', code: 'mr' }
];
