import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import {
  Conversation,
  DirectMessage,
  SocialMember,
  UnreadMessageCounts,
} from '../models/messaging.model';

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);

  readonly totalUnread = signal(0);
  readonly unreadBySender = signal<Record<string, number>>({});
  readonly unreadError = signal<string | null>(null);

  members() {
    return this.http.get<SocialMember[]>('/api/users');
  }

  conversation(userId: string) {
    return this.http.get<Conversation>(`/api/messages/${userId}`);
  }

  refreshUnreadCounts() {
    return this.http.get<UnreadMessageCounts>('/api/messages/unread-counts').pipe(
      tap((counts) => {
        this.totalUnread.set(counts.total);
        this.unreadError.set(null);
        this.unreadBySender.set(
          Object.fromEntries(
            counts.bySender.map(({ senderId, count }) => [senderId, count]),
          ),
        );
      }),
      tap({
        error: (error: unknown) => {
          console.error('[MessagingService] Compteurs non lus indisponibles', error);
          this.unreadError.set(
            'Notifications indisponibles. Redémarrez le backend puis actualisez la page.',
          );
        },
      }),
    );
  }

  unreadCount(senderId: string): number {
    return this.unreadBySender()[senderId] ?? 0;
  }

  clearUnreadCounts(): void {
    this.totalUnread.set(0);
    this.unreadBySender.set({});
    this.unreadError.set(null);
  }

  send(userId: string, content: string) {
    return this.http.post<DirectMessage>(`/api/messages/${userId}`, { content });
  }
}
