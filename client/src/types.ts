export type Role = 'Host' | 'Moderator' | 'Participant';

export type PlayState = 'playing' | 'paused' | 'buffering' | 'unstarted';

export interface ParticipantData {
  userId: string;
  username: string;
  role: Role;
  joinedAt: number;
  isConnected: boolean;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  suggestedBy: string;
  suggestedAt: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  performer: string;
  details: string;
}

export interface VideoState {
  videoId: string;
  playState: PlayState;
  currentTime: number;
  updatedAt: number;
}

export interface SyncStatePayload {
  videoId: string;
  playState: PlayState;
  currentTime: number;
  serverTime: number;
  updatedAt: number;
}

export interface ChangeRequest {
  requestId: string;
  userId: string;
  username: string;
  type: 'change_video' | 'seek' | 'play' | 'pause' | 'add_to_queue';
  payload: any;
  requestedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  role: Role;
  text: string;
  timestamp: number;
  audioUrl?: string;
  audioDuration?: number;
}

export interface EmojiReaction {
  id: string;
  emoji: string;
  userId: string;
  username: string;
  timestamp: number;
}
