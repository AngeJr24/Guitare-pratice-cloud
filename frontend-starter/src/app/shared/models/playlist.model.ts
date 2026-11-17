import { Track } from './track.model';

export type PlaylistVisibility = 'private' | 'public' | 'collaborative';

export interface PlaylistTrack {
  track: Pick<Track, 'id' | 'title' | 'originalName' | 'mimeType' | 'size'>;
  addedBy: string;
  addedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  visibility: PlaylistVisibility;
  owner: { id: string; name: string };
  trackCount: number;
  tracks?: PlaylistTrack[];
  createdAt: string;
  updatedAt: string;
}
