export type PostVisibility = 'public' | 'private';

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
  };
  content: string;
  visibility: PostVisibility;
  audio: CommunityAudio | null;
  media: CommunityMedia[];
  createdAt: string;
}
