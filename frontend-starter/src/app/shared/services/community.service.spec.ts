import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Page } from '../models/page.model';
import { CommunityPost } from '../models/community-post.model';
import { CommunityService } from './community.service';

describe('CommunityService', () => {
  it('requests the selected page of community posts', () => {
    const response: Page<CommunityPost> = {
      items: [],
      page: 2,
      limit: 10,
      total: 12,
      pages: 2,
    };
    const get = vi.fn(() => of(response));
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { get } }],
    });
    const service = runInInjectionContext(
      injector,
      () => new CommunityService(),
    );
    let result: typeof response | undefined;

    service.list(2).subscribe((page) => {
      result = page;
    });

    expect(get).toHaveBeenCalledWith('/api/posts', {
      params: { page: 2, limit: 10 },
    });
    expect(result).toEqual(response);
    injector.destroy();
  });

  it('sends a text publication to the authenticated posts endpoint', () => {
    const post = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Nouvelle découverte',
      visibility: 'public' as const,
      createdAt: '2026-10-14T00:00:00.000Z',
    };
    const postRequest = vi.fn(() => of(post));
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { post: postRequest } }],
    });
    const service = runInInjectionContext(
      injector,
      () => new CommunityService(),
    );
    let result: CommunityPost | undefined;

    service.create(post.content, 'public').subscribe((created) => {
      result = created;
    });

    expect(postRequest).toHaveBeenCalledWith('/api/posts', {
      content: 'Nouvelle découverte',
      visibility: 'public',
    });
    expect(result).toEqual(post);
    injector.destroy();
  });

  it('updates a post with its new text and visibility', () => {
    const updated = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Texte modifié',
      visibility: 'private' as const,
      createdAt: '2026-10-14T00:00:00.000Z',
    };
    const patch = vi.fn(() => of(updated));
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { patch } }],
    });
    const service = runInInjectionContext(
      injector,
      () => new CommunityService(),
    );
    let result: CommunityPost | undefined;

    service.update('post-1', 'Texte modifié', 'private').subscribe((post) => {
      result = post;
    });

    expect(patch).toHaveBeenCalledWith('/api/posts/post-1', {
      content: 'Texte modifié',
      visibility: 'private',
    });
    expect(result).toEqual(updated);
    injector.destroy();
  });

  it('deletes the selected post', () => {
    const deleteRequest = vi.fn(() => of(undefined));
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { delete: deleteRequest } }],
    });
    const service = runInInjectionContext(
      injector,
      () => new CommunityService(),
    );

    service.delete('post-1').subscribe();

    expect(deleteRequest).toHaveBeenCalledWith('/api/posts/post-1');
    injector.destroy();
  });
});
