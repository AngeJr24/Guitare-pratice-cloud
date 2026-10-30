import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  it('loads members and the selected private conversation', () => {
    const get = vi.fn((url: string) =>
      url === '/api/messages/unread-counts'
        ? of({ total: 2, bySender: [{ senderId: 'member-1', count: 2 }] })
        : of([]),
    );
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { get } }],
    });
    const service = runInInjectionContext(
      injector,
      () => new MessagingService(),
    );

    service.members().subscribe();
    service.conversation('member-1').subscribe();
    service.refreshUnreadCounts().subscribe();

    expect(get).toHaveBeenNthCalledWith(1, '/api/users');
    expect(get).toHaveBeenNthCalledWith(2, '/api/messages/member-1');
    expect(get).toHaveBeenNthCalledWith(3, '/api/messages/unread-counts');
    expect(service.totalUnread()).toBe(2);
    expect(service.unreadCount('member-1')).toBe(2);
    service.clearUnreadCounts();
    expect(service.totalUnread()).toBe(0);
    expect(service.unreadError()).toBeNull();
    injector.destroy();
  });

  it('sends a message to the selected member', () => {
    const post = vi.fn(() => of({}));
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { post } }],
    });
    const service = runInInjectionContext(
      injector,
      () => new MessagingService(),
    );

    service.send('member-1', 'Salut !').subscribe();

    expect(post).toHaveBeenCalledWith('/api/messages/member-1', {
      content: 'Salut !',
    });
    injector.destroy();
  });
});
