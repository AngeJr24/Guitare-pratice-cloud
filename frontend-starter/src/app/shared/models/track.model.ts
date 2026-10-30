/** Audio track metadata returned by the API. */
export type TrackCategory = 'uploaded';

export interface Track {
  id: string;
  ownerId: string;
  category?: TrackCategory;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
