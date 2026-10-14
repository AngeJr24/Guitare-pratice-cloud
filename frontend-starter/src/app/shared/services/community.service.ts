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

  create(content: string, visibility: PostVisibility = 'public') {
    return this.http.post<CommunityPost>('/api/posts', { content, visibility });
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
}
