import { ProfilePhoto } from './user.model';

export interface SocialMember {
  id: string;
  name: string;
  profilePhoto?: ProfilePhoto | null;
}

export interface DirectMessage {
  id: string;
  sender: SocialMember;
  recipient: SocialMember;
  content: string;
  createdAt: string;
}

export interface Conversation {
  member: SocialMember;
  items: DirectMessage[];
}

export interface UnreadMessageCounts {
  total: number;
  bySender: Array<{ senderId: string; count: number }>;
}
