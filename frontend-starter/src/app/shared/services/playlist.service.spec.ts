import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistService } from './playlist.service';

describe('PlaylistService', () => {
  it('uses the playlist API for listing, editing, membership and playback', () => {
    const get = vi.fn(() => of([]));
    const post = vi.fn(() => of({}));
    const patch = vi.fn(() => of({}));
    const deleteRequest = vi.fn(() => of({}));
    const injector = Injector.create({
      providers: [{
        provide: HttpClient,
        useValue: { get, post, patch, delete: deleteRequest },
      }],
    });
    const service = runInInjectionContext(injector, () => new PlaylistService());

    service.list().subscribe();
    service.get('playlist-1').subscribe();
    service.create('Répétition', 'collaborative').subscribe();
    service.update('playlist-1', 'Jam', 'public').subscribe();
    service.addTrack('playlist-1', 'track-1').subscribe();
    service.removeTrack('playlist-1', 'track-1').subscribe();
    service.audio('playlist-1', 'track-1').subscribe();
    service.delete('playlist-1').subscribe();

    expect(get).toHaveBeenNthCalledWith(1, '/api/playlists');
    expect(get).toHaveBeenNthCalledWith(2, '/api/playlists/playlist-1');
    expect(get).toHaveBeenNthCalledWith(
      3,
      '/api/playlists/playlist-1/tracks/track-1/audio',
      { responseType: 'blob' },
    );
    expect(post).toHaveBeenNthCalledWith(1, '/api/playlists', {
      name: 'Répétition',
      visibility: 'collaborative',
    });
    expect(patch).toHaveBeenCalledWith('/api/playlists/playlist-1', {
      name: 'Jam',
      visibility: 'public',
    });
    expect(post).toHaveBeenNthCalledWith(2, '/api/playlists/playlist-1/tracks', {
      trackId: 'track-1',
    });
    expect(deleteRequest).toHaveBeenNthCalledWith(
      1,
      '/api/playlists/playlist-1/tracks/track-1',
    );
    expect(deleteRequest).toHaveBeenNthCalledWith(2, '/api/playlists/playlist-1');
    injector.destroy();
  });
});
