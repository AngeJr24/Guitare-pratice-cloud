export type PostVisibility = 'public' | 'private';

export interface CommunityPost {
  id: string;
  author: {
    id: string;
    name: string;
  };
  content: string;
  visibility: PostVisibility;
  createdAt: string;
}
