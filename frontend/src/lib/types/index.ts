export interface User {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  meeting_url: string;
  status: 'scheduled' | 'in_progress' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  meeting_id: string;
  name: string;
  email?: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  start_time: number;
  end_time: number;
  text: string;
}
