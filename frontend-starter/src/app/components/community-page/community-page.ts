import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import {
  CommunityComment,
  CommunityMedia,
  CommunityPost,
  PostReactionType,
  PostVisibility,
} from '../../shared/models/community-post.model';
import { CommunityService } from '../../shared/services/community.service';

@Component({
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPageComponent implements OnDestroy {
  private readonly service = inject(CommunityService);
  private readonly auth = inject(AuthService);
  private loadRequestId = 0;

  readonly posts = signal<CommunityPost[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly view = signal<'recent' | 'mine' | 'create'>('recent');
  readonly loading = signal(false);
  readonly publishing = signal(false);
  readonly loadError = signal('');
  readonly publishError = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly editingPostId = signal<string | null>(null);
  readonly savingPostId = signal<string | null>(null);
  readonly deletingPostId = signal<string | null>(null);
  readonly mediaFiles = signal<File[]>([]);
  readonly postAudioUrls = signal<Record<string, string>>({});
  readonly authorPhotoUrls = signal<Record<string, string>>({});
  readonly loadingAudioPostIds = signal<string[]>([]);
  readonly audioErrors = signal<Record<string, string>>({});
  readonly postMediaUrls = signal<Record<string, string>>({});
  readonly mediaErrors = signal<Record<string, string>>({});
  readonly loadingMediaIds = signal<string[]>([]);
  readonly reactionOptions: {
    type: PostReactionType;
    label: string;
    emoji: string;
  }[] = [
    { type: 'like', label: "J'aime", emoji: '👍' },
    { type: 'love', label: "J'adore", emoji: '❤️' },
    { type: 'haha', label: 'Haha', emoji: '😂' },
    { type: 'wow', label: 'Waouh', emoji: '😮' },
    { type: 'sad', label: 'Triste', emoji: '😢' },
    { type: 'angry', label: 'Grr', emoji: '😡' },
  ];
  readonly openCommentPostIds = signal<string[]>([]);
  readonly commentsByPost = signal<Record<string, CommunityComment[]>>({});
  readonly loadingCommentPostIds = signal<string[]>([]);
  readonly submittingCommentPostIds = signal<string[]>([]);
  readonly commentDrafts = signal<Record<string, string>>({});
  readonly commentErrors = signal<Record<string, string>>({});
  readonly reactionErrors = signal<Record<string, string>>({});
  readonly savingReactionPostIds = signal<string[]>([]);
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
  private readonly authorPhotoRequests = new Subscription();
  private readonly loadingAuthorPhotoIds = new Set<string>();

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    Object.values(this.postAudioUrls()).forEach((url) => URL.revokeObjectURL(url));
    Object.values(this.postMediaUrls()).forEach((url) => URL.revokeObjectURL(url));
    this.authorPhotoRequests.unsubscribe();
    Object.values(this.authorPhotoUrls()).forEach((url) => URL.revokeObjectURL(url));
  }

  loadAuthorPhoto(post: CommunityPost): void {
    const author = post.author;
    if (
      !author.profilePhoto ||
      this.loadingAuthorPhotoIds.has(author.id) ||
      this.authorPhotoUrls()[author.id]
    ) {
      return;
    }

    this.loadingAuthorPhotoIds.add(author.id);
    this.authorPhotoRequests.add(
      this.auth.memberPhoto(author.id).subscribe({
        next: (photo) => {
          this.loadingAuthorPhotoIds.delete(author.id);
          const previousUrl = this.authorPhotoUrls()[author.id];
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          const photoUrl = URL.createObjectURL(photo);
          this.authorPhotoUrls.update((urls) => ({
            ...urls,
            [author.id]: photoUrl,
          }));
        },
        error: (error: unknown) => {
          this.loadingAuthorPhotoIds.delete(author.id);
          console.error('[CommunityPage] Chargement de la photo de l’auteur impossible', error);
        },
      }),
    );
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
        this.mediaErrors.update((errors) => {
          const remaining = { ...errors };
          delete remaining[key];
          return remaining;
        });
        this.loadingMediaIds.update((ids) => ids.filter((id) => id !== key));
      },
      error: (error) => {
        console.error('[CommunityPage] Chargement du média impossible', error);
        this.mediaErrors.update((errors) => ({
          ...errors,
          [key]: error.error?.message ?? 'Impossible de charger ce média.',
        }));
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

  toggleReaction(post: CommunityPost, reaction: PostReactionType): void {
    if (this.savingReactionPostIds().includes(post.id)) {
      return;
    }
    this.savingReactionPostIds.update((ids) => [...ids, post.id]);
    this.reactionErrors.update((errors) => {
      const remaining = { ...errors };
      delete remaining[post.id];
      return remaining;
    });
    const nextReaction = post.myReaction === reaction ? null : reaction;
    this.service.react(post.id, nextReaction).subscribe({
      next: (updatedPost) => {
        this.posts.update((posts) =>
          posts.map((item) => item.id === updatedPost.id ? updatedPost : item),
        );
        this.savingReactionPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
      error: (error) => {
        console.error('[CommunityPage] Enregistrement de la réaction impossible', error);
        this.reactionErrors.update((errors) => ({
          ...errors,
          [post.id]: error.error?.message ?? 'Impossible d’enregistrer votre réaction.',
        }));
        this.savingReactionPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
    });
  }

  toggleComments(post: CommunityPost): void {
    if (this.openCommentPostIds().includes(post.id)) {
      this.openCommentPostIds.update((ids) => ids.filter((id) => id !== post.id));
      return;
    }

    this.openCommentPostIds.update((ids) => [...ids, post.id]);
    if (this.commentsByPost()[post.id] || this.loadingCommentPostIds().includes(post.id)) {
      return;
    }

    this.loadingCommentPostIds.update((ids) => [...ids, post.id]);
    this.commentErrors.update((errors) => {
      const remaining = { ...errors };
      delete remaining[post.id];
      return remaining;
    });
    this.service.comments(post.id).subscribe({
      next: (comments) => {
        this.commentsByPost.update((items) => ({ ...items, [post.id]: comments }));
        this.loadingCommentPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
      error: (error) => {
        console.error('[CommunityPage] Chargement des commentaires impossible', error);
        this.commentErrors.update((errors) => ({
          ...errors,
          [post.id]: error.error?.message ?? 'Impossible de charger les commentaires.',
        }));
        this.loadingCommentPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
    });
  }

  setCommentDraft(postId: string, event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.commentDrafts.update((drafts) => ({ ...drafts, [postId]: input.value }));
  }

  commentsFor(postId: string): CommunityComment[] {
    return this.commentsByPost()[postId] ?? [];
  }

  commentDraft(postId: string): string {
    return this.commentDrafts()[postId] ?? '';
  }

  submitComment(post: CommunityPost): void {
    const content = (this.commentDrafts()[post.id] ?? '').trim();
    if (!content || content.length > 1000 || this.submittingCommentPostIds().includes(post.id)) {
      return;
    }

    this.submittingCommentPostIds.update((ids) => [...ids, post.id]);
    this.commentErrors.update((errors) => {
      const remaining = { ...errors };
      delete remaining[post.id];
      return remaining;
    });
    this.service.addComment(post.id, content).subscribe({
      next: (comment) => {
        this.commentsByPost.update((items) => ({
          ...items,
          [post.id]: [...(items[post.id] ?? []), comment],
        }));
        this.commentDrafts.update((drafts) => ({ ...drafts, [post.id]: '' }));
        this.submittingCommentPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
      error: (error) => {
        console.error('[CommunityPage] Envoi du commentaire impossible', error);
        this.commentErrors.update((errors) => ({
          ...errors,
          [post.id]: error.error?.message ?? 'Impossible d’envoyer le commentaire.',
        }));
        this.submittingCommentPostIds.update((ids) => ids.filter((id) => id !== post.id));
      },
    });
  }

  load(): void {
    if (this.view() === 'create') {
      return;
    }
    const requestId = ++this.loadRequestId;
    const requestedView = this.view();
    const currentUserId = this.currentUserId();
    this.loading.set(true);
    this.loadError.set('');
    const scope = requestedView === 'mine' ? 'mine' : 'recent';
    this.service
      .list(this.page(), 10, scope)
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          if (this.page() > response.pages) {
            this.page.set(response.pages);
            this.load();
            return;
          }
          this.posts.set(
            requestedView === 'mine'
              ? response.items.filter((post) => post.author.id === currentUserId)
              : response.items,
          );
          this.pages.set(response.pages);
          this.posts().forEach((post) => {
            this.loadAuthorPhoto(post);
            post.media.forEach((media) => this.loadPostMedia(post, media));
          });
          this.loading.set(false);
        },
        error: (error) => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          console.error('[CommunityPage] Chargement du fil impossible', error);
          this.loadError.set(
            error.error?.message ?? 'Le fil est momentanément indisponible.',
          );
          this.loading.set(false);
        },
      });
  }

  selectView(view: 'recent' | 'mine' | 'create'): void {
    if (view === this.view()) {
      return;
    }
    this.loadRequestId++;
    this.view.set(view);
    this.page.set(1);
    this.posts.set([]);
    this.editingPostId.set(null);
    this.actionError.set('');
    this.actionSuccess.set('');
    this.loadError.set('');
    if (view !== 'create') {
      this.load();
    }
  }

  publish(): void {
    const text = this.content.value.trim();

    if (
      (!text && this.mediaFiles().length === 0) ||
      text.length > 2000 ||
      this.publishing()
    ) {
      this.content.setValue(text);
      this.publishError.set('Ajoutez un texte, une photo ou une vidéo.');
      return;
    }

    this.publishing.set(true);
    this.publishError.set('');
    this.service.create(text, this.visibility.value, this.mediaFiles()).subscribe({
      next: () => {
        this.content.reset('');
        this.visibility.reset('public');
        this.mediaFiles.set([]);
        this.view.set('recent');
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

  togglePostVisibility(post: CommunityPost): void {
    if (this.savingPostId()) {
      return;
    }

    const visibility: PostVisibility =
      post.visibility === 'private' ? 'public' : 'private';
    this.savingPostId.set(post.id);
    this.actionError.set('');
    this.actionSuccess.set('');
    this.service.update(post.id, post.content, visibility).subscribe({
      next: (updatedPost) => {
        this.posts.update((posts) =>
          posts.map((item) =>
            item.id === updatedPost.id ? updatedPost : item,
          ),
        );
        this.actionSuccess.set(
          visibility === 'private'
            ? 'Publication rendue privée.'
            : 'Publication rendue publique.',
        );
        this.savingPostId.set(null);
      },
      error: (error) => {
        console.error('[CommunityPage] Changement de visibilité impossible', error);
        this.actionError.set(
          error.error?.message ?? 'Impossible de modifier la visibilité.',
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
