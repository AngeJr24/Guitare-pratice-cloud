import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Playlist, PlaylistVisibility } from '../models/playlist.model';

/** Provides authenticated playlist operations and collaborative playback. */
@Injectable({ providedIn: 'root' })
export class PlaylistService {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Playlist[]>('/api/playlists');
  }

  get(id: string) {
    return this.http.get<Playlist>(`/api/playlists/${id}`);
  }

  create(name: string, visibility: PlaylistVisibility) {
    return this.http.post<Playlist>('/api/playlists', { name, visibility });
  }

  update(id: string, name: string, visibility: PlaylistVisibility) {
    return this.http.patch<Playlist>(`/api/playlists/${id}`, { name, visibility });
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/playlists/${id}`);
  }

  addTrack(playlistId: string, trackId: string) {
    return this.http.post<Playlist>(`/api/playlists/${playlistId}/tracks`, { trackId });
  }

  removeTrack(playlistId: string, trackId: string) {
    return this.http.delete<Playlist>(`/api/playlists/${playlistId}/tracks/${trackId}`);
  }

  audio(playlistId: string, trackId: string) {
    return this.http.get(`/api/playlists/${playlistId}/tracks/${trackId}/audio`, {
      responseType: 'blob',
    });
  }
}
