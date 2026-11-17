import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Playlist, PlaylistTrack } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../../shared/services/auth.service';
import { PlaylistService } from '../../shared/services/playlist.service';
import { TrackService } from '../../shared/services/track.service';
import { PlaylistsPageComponent } from './playlists-page';

describe('PlaylistsPageComponent', () => {
  it('saves a public visibility change for the playlist owner', () => {
    const playlist: Playlist = {
      id: 'playlist-1',
      name: 'Jam',
      visibility: 'private',
      owner: { id: 'member-1', name: 'Membre' },
      trackCount: 0,
      tracks: [],
      createdAt: '',
      updatedAt: '',
    };
    const update = vi.fn(() => of({ ...playlist, visibility: 'public' as const }));
    const injector = Injector.create({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'member-1', name: 'Membre' }) },
        },
        {
          provide: PlaylistService,
          useValue: { list: () => of([]), get: () => of(playlist), update },
        },
        {
          provide: TrackService,
          useValue: {
            list: () => of({ items: [], page: 1, limit: 20, total: 0, pages: 1 }),
          },
        },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new PlaylistsPageComponent(),
    );

    component.selectedPlaylist.set(playlist);
    component.editName.setValue('Jam');
    component.editVisibility.setValue('public');
    component.savePlaylist();

    expect(update).toHaveBeenCalledWith('playlist-1', 'Jam', 'public');
    expect(component.selectedPlaylist()?.visibility).toBe('public');
    injector.destroy();
  });

  it('only lets the owner or a contributor remove the corresponding track', () => {
    const currentUser = signal({ id: 'member-1', name: 'Membre' });
    const auth = { currentUser };
    const playlistService = {
      list: () => of([]),
      get: () => of({}),
    };
    const trackService = {
      list: () => of({ items: [], page: 1, limit: 20, total: 0, pages: 1 }),
    };
    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: PlaylistService, useValue: playlistService },
        { provide: TrackService, useValue: trackService },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new PlaylistsPageComponent(),
    );
    const playlist: Playlist = {
      id: 'playlist-1',
      name: 'Jam',
      visibility: 'collaborative',
      owner: { id: 'owner-1', name: 'Créateur' },
      trackCount: 1,
      createdAt: '',
      updatedAt: '',
    };
    const contribution: PlaylistTrack = {
      track: {
        id: 'track-1',
        title: 'Riff',
        originalName: 'riff.mp3',
        mimeType: 'audio/mpeg',
        size: 12,
      },
      addedBy: 'member-1',
      addedAt: '',
    };

    component.selectedPlaylist.set(playlist);
    expect(component.canRemoveTrack(contribution)).toBe(true);

    component.selectedPlaylist.set({ ...playlist, visibility: 'public' });
    expect(component.canRemoveTrack(contribution)).toBe(false);

    component.selectedPlaylist.set({ ...playlist, owner: { id: 'member-1', name: 'Membre' } });
    expect(component.canRemoveTrack({ ...contribution, addedBy: 'other-member' })).toBe(true);
    injector.destroy();
  });

  it('offers only personally uploaded tracks that are not already in the playlist', () => {
    const ownedTrack: Track = {
      id: 'track-1',
      ownerId: 'member-1',
      title: 'Riff',
      originalName: 'riff.mp3',
      mimeType: 'audio/mpeg',
      size: 12,
      createdAt: '',
    };
    const unusedTrack: Track = { ...ownedTrack, id: 'track-2', title: 'Solo' };
    const playlist: Playlist = {
      id: 'playlist-1',
      name: 'Jam',
      visibility: 'private',
      owner: { id: 'member-1', name: 'Membre' },
      trackCount: 1,
      tracks: [{
        track: {
          id: 'track-1',
          title: 'Riff',
          originalName: 'riff.mp3',
          mimeType: 'audio/mpeg',
          size: 12,
        },
        addedBy: 'member-1',
        addedAt: '',
      }],
      createdAt: '',
      updatedAt: '',
    };
    const trackService = {
      list: (page: number) => of({
        items: page === 1 ? [ownedTrack] : [unusedTrack],
        page,
        limit: 20,
        total: 21,
        pages: 2,
      }),
    };
    const injector = Injector.create({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'member-1', name: 'Membre' }) },
        },
        {
          provide: PlaylistService,
          useValue: { list: () => of([]), get: () => of(playlist) },
        },
        {
          provide: TrackService,
          useValue: trackService,
        },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new PlaylistsPageComponent(),
    );

    component.selectedPlaylist.set(playlist);

    expect(component.availableTracks().map((track) => track.id)).toEqual(['track-2']);
    injector.destroy();
  });
});
