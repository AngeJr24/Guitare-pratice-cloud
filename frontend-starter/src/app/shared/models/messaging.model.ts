export interface SocialMember {
  id: string;
  name: string;
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
