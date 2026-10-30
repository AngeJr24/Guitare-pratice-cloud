import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../shared/services/auth.service';
import { CommunityService } from '../../shared/services/community.service';
import { TrackService } from '../../shared/services/track.service';
import { CommunityPageComponent } from './community-page';

describe('CommunityPageComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createHarness = (create = vi.fn(() => of({}))) => {
    const service = {
      list: vi.fn(() =>
        of({ items: [], page: 1, limit: 10, total: 0, pages: 1 }),
      ),
      create,
      update: vi.fn(),
      delete: vi.fn(),
      media: vi.fn(() => of(new Blob())),
    };
    const injector = Injector.create({
      providers: [
        { provide: CommunityService, useValue: service },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'user-1', name: 'Ange' }) } },
        { provide: TrackService, useValue: { listTracklists: vi.fn(() => of([])) } },
      ],
    });
    return {
      component: runInInjectionContext(injector, () => new CommunityPageComponent()),
      injector,
      service,
    };
  };

  it('publishes the text and selected library audio together', () => {
    const create = vi.fn(() => of({}));
    const { component, injector, service } = createHarness(create);
    component.availableTracks.set([{
      id: 'track-1',
      ownerId: 'user-1',
      title: 'Répétition',
      originalName: 'repetition.mp3',
      mimeType: 'audio/mpeg',
      size: 100,
      createdAt: '2026-10-29T00:00:00.000Z',
    }]);
    component.content.setValue('  Nouvelle découverte  ');
    component.selectedTrackId.set('track-1');

    component.publish();

    expect(service.create).toHaveBeenCalledWith(
      'Nouvelle découverte',
      'public',
      'track-1',
      [],
    );
    expect(component.content.value).toBe('');
    injector.destroy();
  });

  it('requires content or an audio/photo/video attachment', () => {
    const { component, injector, service } = createHarness();

    component.publish();

    expect(service.create).not.toHaveBeenCalled();
    expect(component.publishError()).toContain('Ajoutez un texte');
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
      undefined,
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
