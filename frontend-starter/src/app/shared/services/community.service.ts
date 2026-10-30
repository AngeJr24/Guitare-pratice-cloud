import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Page } from '../models/page.model';
import {
  CommunityPost,
  PostVisibility,
} from '../models/community-post.model';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 10) {
    return this.http.get<Page<CommunityPost>>('/api/posts', {
      params: { page, limit },
    });
  }

  create(
    content: string,
    visibility: PostVisibility = 'public',
    trackId?: string,
    media: File[] = [],
  ) {
    const body = new FormData();
    body.append('visibility', visibility);
    if (content.trim()) {
      body.append('content', content.trim());
    }
    if (trackId) {
      body.append('trackId', trackId);
    }
    for (const file of media) {
      body.append('media', file);
    }
    return this.http.post<CommunityPost>('/api/posts', body);
  }

  update(id: string, content: string, visibility: PostVisibility) {
    return this.http.patch<CommunityPost>(`/api/posts/${id}`, {
      content,
      visibility,
    });
  }

  delete(id: string) {
    return this.http.delete<void>(`/api/posts/${id}`);
  }

  audio(id: string) {
    return this.http.get(`/api/posts/${id}/audio`, { responseType: 'blob' });
  }

  media(postId: string, mediaId: string) {
    return this.http.get(`/api/posts/${postId}/media/${mediaId}`, {
      responseType: 'blob',
    });
  }
}
