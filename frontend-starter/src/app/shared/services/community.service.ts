import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Page } from '../models/page.model';
import {
  CommunityComment,
  CommunityPost,
  PostReactionType,
  PostVisibility,
} from '../models/community-post.model';

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private readonly http = inject(HttpClient);

  list(
    page = 1,
    limit = 10,
    scope: 'recent' | 'mine' = 'recent',
    visibility: 'all' | PostVisibility = 'all',
  ) {
    const params: Record<string, string | number> = { page, limit };
    if (scope !== 'recent') {
      params['scope'] = scope;
    }
    if (visibility !== 'all') {
      params['visibility'] = visibility;
    }
    return this.http.get<Page<CommunityPost>>('/api/posts', {
      params,
    });
  }

  create(
    content: string,
    visibility: PostVisibility = 'public',
    media: File[] = [],
  ) {
    const body = new FormData();
    body.append('visibility', visibility);
    if (content.trim()) {
      body.append('content', content.trim());
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

  react(postId: string, reaction: PostReactionType | null) {
    return this.http.put<CommunityPost>(`/api/posts/${postId}/reaction`, {
      reaction,
    });
  }

  comments(postId: string) {
    return this.http.get<CommunityComment[]>(`/api/posts/${postId}/comments`);
  }

  addComment(postId: string, content: string) {
    return this.http.post<CommunityComment>(`/api/posts/${postId}/comments`, {
      content,
    });
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
