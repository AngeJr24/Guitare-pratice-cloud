import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../shared/services/auth.service';
import { CommunityPost } from '../../shared/models/community-post.model';
import { CommunityService } from '../../shared/services/community.service';
import { CommunityPageComponent } from './community-page';

describe('CommunityPageComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createHarness = (create = vi.fn(() => of({}))) => {
    const service = {
      list: vi.fn(() =>
        of({ items: [] as CommunityPost[], page: 1, limit: 10, total: 0, pages: 1 }),
      ),
      create,
      update: vi.fn(),
      delete: vi.fn(),
      react: vi.fn(),
      comments: vi.fn(() => of([])),
      addComment: vi.fn(),
      media: vi.fn(() => of(new Blob())),
    };
    const auth = {
      currentUser: signal({ id: 'user-1', name: 'Ange' }),
      memberPhoto: vi.fn(() => of(new Blob(['avatar'], { type: 'image/png' }))),
    };
    const injector = Injector.create({
      providers: [
        { provide: CommunityService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    });
    return {
      component: runInInjectionContext(injector, () => new CommunityPageComponent()),
      injector,
      service,
      auth,
    };
  };

  it('publishes text and selected media without attaching audio', () => {
    const create = vi.fn(() => of({}));
    const { component, injector, service } = createHarness(create);
    const photo = new File(['image'], 'photo.png', { type: 'image/png' });
    component.mediaFiles.set([photo]);
    component.content.setValue('  Nouvelle découverte  ');

    component.publish();

    expect(service.create).toHaveBeenCalledWith(
      'Nouvelle découverte',
      'public',
      [photo],
    );
    expect(component.content.value).toBe('');
    injector.destroy();
  });

  it('requires content or an audio/photo/video attachment', () => {
    const { component, injector, service } = createHarness();

    component.publish();

    expect(service.create).not.toHaveBeenCalled();
    expect(component.publishError()).toContain('Ajoutez un texte, une photo');
    injector.destroy();
  });

  it('loads media automatically when community posts are loaded', () => {
    const { component, injector, service } = createHarness();
    const post: CommunityPost = {
      id: 'post-1',
      author: { id: 'user-2', name: 'Sam' },
      content: 'Photo du jour',
      visibility: 'public',
      audio: null,
      media: [{
        id: 'media-1',
        originalName: 'photo.png',
        mimeType: 'image/png',
        size: 100,
      }],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    service.list.mockReturnValue(of({
      items: [post],
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    }));
    service.media.mockReturnValue(
      throwError(() => new Error('test media failure')),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    component.load();

    expect(service.media).toHaveBeenCalledWith('post-1', 'media-1');
    expect(component.mediaErrors()['post-1:media-1']).toContain(
      'Impossible de charger ce média',
    );
    injector.destroy();
  });

  it('loads the profile photo of a post author', () => {
    const { component, injector, auth } = createHarness();
    const photoUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue(
      'blob:author-photo',
    );
    const post: CommunityPost = {
      id: 'post-1',
      author: {
        id: 'user-2',
        name: 'Sam',
        profilePhoto: { mimeType: 'image/png', size: 5 },
      },
      content: 'Une découverte',
      visibility: 'public',
      audio: null,
      media: [],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-11-16T00:00:00.000Z',
    };

    component.loadAuthorPhoto(post);

    expect(auth.memberPhoto).toHaveBeenCalledWith('user-2');
    expect(component.authorPhotoUrls()['user-2']).toBe('blob:author-photo');
    expect(photoUrl).toHaveBeenCalledOnce();
    injector.destroy();
  });

  it('loads the user posts when selecting the personal view', () => {
    const { component, injector, service } = createHarness();

    component.selectView('mine');

    expect(component.view()).toBe('mine');
    expect(service.list).toHaveBeenLastCalledWith(1, 10, 'mine');
    injector.destroy();
  });

  it('does not let a late recent-feed response overwrite personal posts', () => {
    const recentResponse = new Subject<{
      items: CommunityPost[];
      page: number;
      limit: number;
      total: number;
      pages: number;
    }>();
    const mineResponse = new Subject<{
      items: CommunityPost[];
      page: number;
      limit: number;
      total: number;
      pages: number;
    }>();
    const { component, injector, service } = createHarness();
    service.list
      .mockReturnValueOnce(recentResponse)
      .mockReturnValueOnce(mineResponse);
    component.load();
    component.selectView('mine');

    const ownPost: CommunityPost = {
      id: 'own-post',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Publication personnelle',
      visibility: 'public',
      audio: null,
      media: [],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    const otherPost: CommunityPost = {
      ...ownPost,
      id: 'other-post',
      author: { id: 'user-2', name: 'Sam' },
      content: 'Publication récente',
    };
    mineResponse.next({
      items: [ownPost],
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    });
    recentResponse.next({
      items: [otherPost],
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
    });

    expect(component.posts()).toEqual([ownPost]);
    injector.destroy();
  });

  it('displays only posts owned by the connected user in the personal view', () => {
    const { component, injector, service } = createHarness();
    const ownPost: CommunityPost = {
      id: 'own-post',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Publication personnelle',
      visibility: 'public',
      audio: null,
      media: [],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    const otherPost: CommunityPost = {
      ...ownPost,
      id: 'other-post',
      author: { id: 'user-2', name: 'Sam' },
      content: 'Publication d’un autre membre',
    };
    service.list.mockReturnValue(of({
      items: [ownPost, otherPost],
      page: 1,
      limit: 10,
      total: 2,
      pages: 1,
    }));

    component.selectView('mine');

    expect(component.posts()).toEqual([ownPost]);
    injector.destroy();
  });

  it('opens the publication form without reloading the feed', () => {
    const { component, injector, service } = createHarness();
    const initialListCalls = service.list.mock.calls.length;

    component.selectView('create');

    expect(component.view()).toBe('create');
    expect(service.list).toHaveBeenCalledTimes(initialListCalls);
    injector.destroy();
  });

  it('saves a reaction and updates the post state', () => {
    const { component, injector, service } = createHarness();
    const post: CommunityPost = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Une publication',
      visibility: 'public',
      audio: null,
      media: [],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    const likedPost: CommunityPost = {
      ...post,
      reactionCounts: { ...post.reactionCounts, like: 1 },
      myReaction: 'like',
    };
    component.posts.set([post]);
    service.react.mockReturnValue(of(likedPost));

    component.toggleReaction(post, 'like');

    expect(service.react).toHaveBeenCalledWith('post-1', 'like');
    expect(component.posts()[0]).toEqual(likedPost);
    injector.destroy();
  });

  it('loads comments and appends a submitted comment', () => {
    const { component, injector, service } = createHarness();
    const post: CommunityPost = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Une publication',
      visibility: 'public',
      audio: null,
      media: [],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    const comment = {
      id: 'comment-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Super !',
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    service.comments.mockReturnValue(of([]));
    service.addComment.mockReturnValue(of(comment));
    component.setCommentDraft('post-1', {
      target: { value: '  Super !  ' },
    } as unknown as Event);

    component.toggleComments(post);
    component.submitComment(post);

    expect(service.comments).toHaveBeenCalledWith('post-1');
    expect(service.addComment).toHaveBeenCalledWith('post-1', 'Super !');
    expect(component.commentsByPost()['post-1']).toEqual([comment]);
    expect(component.commentDrafts()['post-1']).toBe('');
    injector.destroy();
  });

  it('changes a post visibility from its personal post actions', () => {
    const { component, injector, service } = createHarness();
    const post: CommunityPost = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Publication personnelle',
      visibility: 'public',
      audio: null,
      media: [],
      reactionCounts: {
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
      },
      myReaction: null,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    const privatePost = { ...post, visibility: 'private' as const };
    component.posts.set([post]);
    service.update.mockReturnValue(of(privatePost));

    component.togglePostVisibility(post);

    expect(service.update).toHaveBeenCalledWith(
      'post-1',
      'Publication personnelle',
      'private',
    );
    expect(component.posts()).toEqual([privatePost]);
    injector.destroy();
  });

  it('includes selected media files in a publication', () => {
    const create = vi.fn(() => of({}));
    const { component, injector, service } = createHarness(create);
    const photo = new File(['image'], 'photo.png', { type: 'image/png' });
    component.mediaFiles.set([photo]);
    component.content.setValue('Mon moment musical');

    component.publish();

    expect(service.create).toHaveBeenCalledWith(
      'Mon moment musical',
      'public',
      [photo],
    );
    expect(component.mediaFiles()).toEqual([]);
    injector.destroy();
  });

  it('rejects unsupported media formats and oversized files', () => {
    const { component, injector } = createHarness();
    const input = {
      files: [new File(['data'], 'script.svg', { type: 'image/svg+xml' })],
      value: 'selected',
    };
    component.addMediaFiles({ target: input } as unknown as Event);

    expect(component.mediaFiles()).toEqual([]);
    expect(component.publishError()).toContain('Formats acceptés');
    expect(input.value).toBe('');
    injector.destroy();
  });
});
