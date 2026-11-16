import { ProfilePhoto } from './user.model';

export type PostVisibility = 'public' | 'private';
export type PostReactionType =
  | 'like'
  | 'love'
  | 'haha'
  | 'wow'
  | 'sad'
  | 'angry';

export interface CommunityComment {
  id: string;
  author: {
    id: string;
    name: string;
  };
  content: string;
  createdAt: string;
}

export interface CommunityAudio {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface CommunityMedia {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface CommunityPost {
  id: string;
  author: {
    id: string;
    name: string;
    profilePhoto?: ProfilePhoto | null;
  };
  content: string;
  visibility: PostVisibility;
  audio: CommunityAudio | null;
  media: CommunityMedia[];
  reactionCounts: Record<PostReactionType, number>;
  myReaction: PostReactionType | null;
  createdAt: string;
}
