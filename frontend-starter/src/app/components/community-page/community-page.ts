import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import {
  CommunityPost,
  PostVisibility,
} from '../../shared/models/community-post.model';
import { CommunityService } from '../../shared/services/community.service';

@Component({
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPageComponent {
  private readonly service = inject(CommunityService);
  private readonly auth = inject(AuthService);

  readonly posts = signal<CommunityPost[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly publishing = signal(false);
  readonly loadError = signal('');
  readonly publishError = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly editingPostId = signal<string | null>(null);
  readonly savingPostId = signal<string | null>(null);
  readonly deletingPostId = signal<string | null>(null);
  readonly visibility = new FormControl<PostVisibility>('public', {
    nonNullable: true,
  });
  readonly editContent = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  readonly editVisibility = new FormControl<PostVisibility>('public', {
    nonNullable: true,
  });
  readonly content = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  readonly form = new FormGroup({
    content: this.content,
    visibility: this.visibility,
  });
  readonly editForm = new FormGroup({
    content: this.editContent,
    visibility: this.editVisibility,
  });
  readonly currentUserId = () => this.auth.currentUser()?.id ?? '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.service.list(this.page()).subscribe({
      next: (response) => {
        if (this.page() > response.pages) {
          this.page.set(response.pages);
          this.load();
          return;
        }
        this.posts.set(response.items);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('[CommunityPage] Chargement du fil impossible', error);
        this.loadError.set(
          error.error?.message ?? 'Le fil est momentanément indisponible.',
        );
        this.loading.set(false);
      },
    });
  }

  publish(): void {
    const text = this.content.value.trim();
    if (!text || text.length > 2000 || this.publishing()) {
      this.content.setValue(text);
      this.content.markAsTouched();
      return;
    }

    this.publishing.set(true);
    this.publishError.set('');
    this.service.create(text, this.visibility.value).subscribe({
      next: () => {
        this.content.reset('');
        this.visibility.reset('public');
        this.page.set(1);
        this.load();
        this.publishing.set(false);
      },
      error: (error) => {
        console.error('[CommunityPage] Publication impossible', error);
        this.publishError.set(
          error.error?.message ?? 'La publication a échoué. Réessayez.',
        );
        this.publishing.set(false);
      },
    });
  }

  startEditing(post: CommunityPost): void {
    this.editingPostId.set(post.id);
    this.editContent.setValue(post.content);
    this.editVisibility.setValue(post.visibility);
    this.actionError.set('');
    this.actionSuccess.set('');
  }

  cancelEditing(): void {
    this.editingPostId.set(null);
    this.editContent.reset('');
    this.editVisibility.reset('public');
  }

  saveEdit(post: CommunityPost): void {
    const content = this.editContent.value.trim();
    if (!content || content.length > 2000 || this.savingPostId()) {
      this.editContent.setValue(content);
      this.editContent.markAsTouched();
      return;
    }

    this.savingPostId.set(post.id);
    this.actionError.set('');
    this.service
      .update(post.id, content, this.editVisibility.value)
      .subscribe({
        next: (updatedPost) => {
          this.posts.update((posts) =>
            posts.map((item) =>
              item.id === updatedPost.id ? updatedPost : item,
            ),
          );
          this.cancelEditing();
          this.actionSuccess.set('Publication modifiée.');
          this.savingPostId.set(null);
        },
        error: (error) => {
          console.error('[CommunityPage] Modification impossible', error);
          this.actionError.set(
            error.error?.message ?? 'Impossible de modifier la publication.',
          );
          this.savingPostId.set(null);
        },
      });
  }

  deletePost(post: CommunityPost): void {
    if (!window.confirm('Supprimer définitivement cette publication ?')) {
      return;
    }

    this.deletingPostId.set(post.id);
    this.actionError.set('');
    this.service.delete(post.id).subscribe({
      next: () => {
        this.posts.update((posts) => posts.filter((item) => item.id !== post.id));
        this.deletingPostId.set(null);
        if (this.posts().length === 0 && this.page() > 1) {
          this.page.update((page) => page - 1);
          this.load();
        }
        this.actionSuccess.set('Publication supprimée.');
      },
      error: (error) => {
        console.error('[CommunityPage] Suppression impossible', error);
        this.actionError.set(
          error.error?.message ?? 'Impossible de supprimer la publication.',
        );
        this.deletingPostId.set(null);
      },
    });
  }

  goToPage(page: number): void {
    const nextPage = Math.min(Math.max(1, page), this.pages());
    if (nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.load();
  }
}
