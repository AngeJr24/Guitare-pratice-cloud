import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import {
  CommunityMedia,
  CommunityPost,
  PostVisibility,
} from '../../shared/models/community-post.model';
import { CommunityService } from '../../shared/services/community.service';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

@Component({
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPageComponent implements OnDestroy {
  private readonly service = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private readonly trackService = inject(TrackService);

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
  readonly availableTracks = signal<Track[]>([]);
  readonly tracklistLoading = signal(false);
  readonly tracklistError = signal('');
  readonly selectedTrackId = signal('');
  readonly mediaFiles = signal<File[]>([]);
  readonly postAudioUrls = signal<Record<string, string>>({});
  readonly loadingAudioPostIds = signal<string[]>([]);
  readonly audioErrors = signal<Record<string, string>>({});
  readonly postMediaUrls = signal<Record<string, string>>({});
  readonly loadingMediaIds = signal<string[]>([]);
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
    validators: [Validators.maxLength(2000)],
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
    this.loadTracklist();
  }

  ngOnDestroy(): void {
    Object.values(this.postAudioUrls()).forEach((url) => URL.revokeObjectURL(url));
    Object.values(this.postMediaUrls()).forEach((url) => URL.revokeObjectURL(url));
  }

  mediaKey(postId: string, mediaId: string): string {
    return `${postId}:${mediaId}`;
  }

  loadPostMedia(post: CommunityPost, media: CommunityMedia): void {
    const key = this.mediaKey(post.id, media.id);
    if (this.postMediaUrls()[key] || this.loadingMediaIds().includes(key)) {
      return;
    }

    this.loadingMediaIds.update((ids) => [...ids, key]);
    this.service.media(post.id, media.id).subscribe({
      next: (blob) => {
        this.postMediaUrls.update((urls) => ({
          ...urls,
          [key]: URL.createObjectURL(blob),
        }));
        this.loadingMediaIds.update((ids) => ids.filter((id) => id !== key));
      },
      error: (error) => {
        console.error('[CommunityPage] Chargement du média impossible', error);
        this.actionError.set(
          error.error?.message ?? 'Impossible de charger ce média.',
        );
        this.loadingMediaIds.update((ids) => ids.filter((id) => id !== key));
      },
    });
  }

  loadPostAudio(post: CommunityPost): void {
    if (!post.audio || this.postAudioUrls()[post.id] || this.loadingAudioPostIds().includes(post.id)) {
      return;
    }

    this.loadingAudioPostIds.update((ids) => [...ids, post.id]);
    this.audioErrors.update((errors) => {
      const remaining = { ...errors };
      delete remaining[post.id];
      return remaining;
    });
    this.service.audio(post.id).subscribe({
      next: (blob) => {
        this.postAudioUrls.update((urls) => ({
          ...urls,
          [post.id]: URL.createObjectURL(blob),
        }));
        this.loadingAudioPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
      error: (error) => {
        console.error('[CommunityPage] Lecture audio impossible', error);
        this.audioErrors.update((errors) => ({
          ...errors,
          [post.id]: error.error?.message ?? 'Impossible de charger ce morceau.',
        }));
        this.loadingAudioPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
    });
  }

  loadTracklist(): void {
    this.tracklistLoading.set(true);
    this.tracklistError.set('');
    this.trackService.listTracklists().subscribe({
      next: (tracks) => {
        this.availableTracks.set(tracks);
        this.tracklistLoading.set(false);
      },
      error: (error) => {
        console.error('[CommunityPage] Chargement de la bibliothèque impossible', error);
        this.tracklistError.set(
          error.error?.message ?? 'Impossible de charger vos pistes.',
        );
        this.tracklistLoading.set(false);
      },
    });
  }

  addMediaFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    const files = [...this.mediaFiles(), ...selected];
    if (files.length > 5) {
      this.publishError.set('Une publication peut contenir au maximum 5 photos ou vidéos.');
      input.value = '';
      return;
    }

    const invalidFile = files.find(
      (file) =>
        !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(file.type) ||
        file.size > 25 * 1024 * 1024,
    );
    if (invalidFile) {
      this.publishError.set(
        'Formats acceptés : JPEG, PNG, WebP, GIF, MP4 et WebM (25 Mo maximum par fichier).',
      );
      input.value = '';
      return;
    }

    this.mediaFiles.set(files);
    this.publishError.set('');
    input.value = '';
  }

  removeMediaFile(index: number): void {
    this.mediaFiles.update((files) => files.filter((_file, fileIndex) => fileIndex !== index));
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
    const trackId = this.selectedTrackId();
    const hasAudio = this.availableTracks().some((track) => track.id === trackId);

    if (
      (!text && !hasAudio && this.mediaFiles().length === 0) ||
      (trackId && !hasAudio) ||
      text.length > 2000 ||
      this.publishing()
    ) {
      this.content.setValue(text);
      if (trackId && !hasAudio) {
        this.publishError.set('Choisissez un audio importé dans Mes tracklists.');
      } else {
        this.publishError.set('Ajoutez un texte, une piste audio ou une photo/vidéo.');
      }
      return;
    }

    this.publishing.set(true);
    this.publishError.set('');
    this.service.create(text, this.visibility.value, trackId || undefined, this.mediaFiles()).subscribe({
      next: () => {
        this.content.reset('');
        this.visibility.reset('public');
        this.selectedTrackId.set('');
        this.mediaFiles.set([]);
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
    if (!globalThis.confirm?.('Supprimer définitivement cette publication ?')) {
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
