import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { Playlist, PlaylistTrack, PlaylistVisibility } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';
import { AuthService } from '../../shared/services/auth.service';
import { PlaylistService } from '../../shared/services/playlist.service';
import { TrackService } from '../../shared/services/track.service';

@Component({
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './playlists-page.html',
  styleUrl: './playlists-page.css',
})
export class PlaylistsPageComponent implements OnDestroy {
  private readonly playlistsApi = inject(PlaylistService);
  private readonly tracksApi = inject(TrackService);
  private audioRequest?: Subscription;
  readonly auth = inject(AuthService);

  readonly playlists = signal<Playlist[]>([]);
  readonly personalTracks = signal<Track[]>([]);
  readonly selectedPlaylist = signal<Playlist | null>(null);
  readonly loadingPlaylists = signal(false);
  readonly loadingTracks = signal(false);
  readonly saving = signal(false);
  readonly addingTrack = signal(false);
  readonly removingTrackId = signal<string | null>(null);
  readonly deletingPlaylist = signal(false);
  readonly listError = signal<string | null>(null);
  readonly trackError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionSuccess = signal<string | null>(null);
  readonly audioUrl = signal('');
  readonly audioError = signal<string | null>(null);
  readonly currentAudioTrackId = signal<string | null>(null);
  readonly currentAudioTrackTitle = signal<string | null>(null);
  readonly selectedTrackId = new FormControl('', { nonNullable: true });

  readonly createForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    visibility: new FormControl<PlaylistVisibility>('private', { nonNullable: true }),
  });
  readonly editName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });
  readonly editVisibility = new FormControl<PlaylistVisibility>('private', { nonNullable: true });
  readonly editForm = new FormGroup({
    name: this.editName,
    visibility: this.editVisibility,
  });
  readonly availableTracks = computed(() => {
    const playlistTrackIds = new Set(
      (this.selectedPlaylist()?.tracks ?? []).map((entry) => entry.track.id),
    );
    return this.personalTracks().filter((track) => !playlistTrackIds.has(track.id));
  });

  constructor() {
    this.loadPlaylists();
    this.loadTracks();
  }

  ngOnDestroy(): void {
    this.releaseAudio();
  }

  loadPlaylists(): void {
    this.loadingPlaylists.set(true);
    this.listError.set(null);
    this.playlistsApi.list().subscribe({
      next: (playlists) => {
        this.playlists.set(playlists);
        this.loadingPlaylists.set(false);
        const selected = this.selectedPlaylist();
        if (selected) {
          const updated = playlists.find((playlist) => playlist.id === selected.id);
          if (updated) {
            this.openPlaylist(updated);
          } else {
            this.selectedPlaylist.set(null);
          }
        }
      },
      error: (error) => {
        console.error('[PlaylistsPage] Chargement des playlists impossible', error);
        this.listError.set(this.getErrorMessage(error, 'Chargement des playlists impossible.'));
        this.loadingPlaylists.set(false);
      },
    });
  }

  loadTracks(): void {
    this.loadingTracks.set(true);
    this.trackError.set(null);
    this.tracksApi.list(1, 20).subscribe({
      next: (firstPage) => {
        const remainingPages = Array.from(
          { length: Math.max(0, firstPage.pages - 1) },
          (_value, index) => this.tracksApi.list(index + 2, 20),
        );
        if (!remainingPages.length) {
          this.personalTracks.set(firstPage.items);
          this.loadingTracks.set(false);
          return;
        }

        forkJoin(remainingPages).subscribe({
          next: (pages) => {
            this.personalTracks.set([
              ...firstPage.items,
              ...pages.flatMap((page) => page.items),
            ]);
            this.loadingTracks.set(false);
          },
          error: (error) => {
            console.error('[PlaylistsPage] Chargement des pages de pistes impossible', error);
            this.trackError.set(this.getErrorMessage(error, 'Chargement de la bibliothèque impossible.'));
            this.loadingTracks.set(false);
          },
        });
      },
      error: (error) => {
        console.error('[PlaylistsPage] Chargement des pistes impossible', error);
        this.trackError.set(this.getErrorMessage(error, 'Chargement de la bibliothèque impossible.'));
        this.loadingTracks.set(false);
      },
    });
  }

  openPlaylist(playlist: Playlist): void {
    this.actionError.set(null);
    this.playlistsApi.get(playlist.id).subscribe({
      next: (details) => {
        this.selectedPlaylist.set(details);
        this.editName.setValue(details.name);
        this.editVisibility.setValue(details.visibility);
        this.selectedTrackId.setValue(this.availableTracks()[0]?.id ?? '');
        this.releaseAudio();
      },
      error: (error) => {
        console.error('[PlaylistsPage] Ouverture de la playlist impossible', error);
        this.actionError.set(this.getErrorMessage(error, 'Ouverture de la playlist impossible.'));
      },
    });
  }

  createPlaylist(): void {
    if (this.createForm.invalid || this.saving()) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);
    const { name, visibility } = this.createForm.getRawValue();
    this.playlistsApi.create(name.trim(), visibility).subscribe({
      next: (playlist) => {
        this.playlists.update((items) => [playlist, ...items]);
        this.createForm.reset({ name: '', visibility: 'private' });
        this.saving.set(false);
        this.openPlaylist(playlist);
      },
      error: (error) => {
        console.error('[PlaylistsPage] Création impossible', error);
        this.actionError.set(this.getErrorMessage(error, 'Création de la playlist impossible.'));
        this.saving.set(false);
      },
    });
  }

  savePlaylist(): void {
    const playlist = this.selectedPlaylist();
    if (!playlist || !this.isOwner(playlist) || this.editName.invalid || this.saving()) {
      this.editName.markAsTouched();
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);
    this.playlistsApi
      .update(playlist.id, this.editName.value.trim(), this.editVisibility.value)
      .subscribe({
        next: (updated) => {
          this.replacePlaylist({ ...updated, tracks: playlist.tracks });
          this.actionSuccess.set('Playlist mise à jour.');
          this.saving.set(false);
        },
        error: (error) => {
          console.error('[PlaylistsPage] Modification impossible', error);
          this.actionError.set(this.getErrorMessage(error, 'Modification de la playlist impossible.'));
          this.saving.set(false);
        },
      });
  }

  deletePlaylist(): void {
    const playlist = this.selectedPlaylist();
    if (!playlist || !this.isOwner(playlist) || this.deletingPlaylist()) {
      return;
    }
    if (!globalThis.confirm?.(`Supprimer définitivement la playlist « ${playlist.name} » ?`)) {
      return;
    }

    this.deletingPlaylist.set(true);
    this.actionError.set(null);
    this.playlistsApi.delete(playlist.id).subscribe({
      next: () => {
        this.playlists.update((items) => items.filter((item) => item.id !== playlist.id));
        this.selectedPlaylist.set(null);
        this.releaseAudio();
        this.deletingPlaylist.set(false);
      },
      error: (error) => {
        console.error('[PlaylistsPage] Suppression impossible', error);
        this.actionError.set(this.getErrorMessage(error, 'Suppression de la playlist impossible.'));
        this.deletingPlaylist.set(false);
      },
    });
  }

  addTrack(): void {
    const playlist = this.selectedPlaylist();
    const trackId = this.selectedTrackId.value;
    if (!playlist || !trackId || this.addingTrack()) {
      return;
    }

    this.addingTrack.set(true);
    this.actionError.set(null);
    this.playlistsApi.addTrack(playlist.id, trackId).subscribe({
      next: (updated) => {
        this.replacePlaylist(updated);
        this.selectedTrackId.setValue(this.availableTracks()[0]?.id ?? '');
        this.actionSuccess.set('Piste ajoutée à la playlist.');
        this.addingTrack.set(false);
      },
      error: (error) => {
        console.error('[PlaylistsPage] Ajout de piste impossible', error);
        this.actionError.set(this.getErrorMessage(error, 'Ajout de la piste impossible.'));
        this.addingTrack.set(false);
      },
    });
  }

  canRemoveTrack(entry: PlaylistTrack): boolean {
    const playlist = this.selectedPlaylist();
    const userId = this.auth.currentUser()?.id;
    return !!playlist && (
      this.isOwner(playlist) ||
      (playlist.visibility === 'collaborative' && entry.addedBy === userId)
    );
  }

  removeTrack(entry: PlaylistTrack): void {
    const playlist = this.selectedPlaylist();
    if (!playlist || !this.canRemoveTrack(entry) || this.removingTrackId()) {
      return;
    }

    this.removingTrackId.set(entry.track.id);
    this.actionError.set(null);
    this.playlistsApi.removeTrack(playlist.id, entry.track.id).subscribe({
      next: (updated) => {
        if (this.currentAudioTrackId() === entry.track.id) {
          this.releaseAudio();
        }
        this.replacePlaylist(updated);
        this.removingTrackId.set(null);
      },
      error: (error) => {
        console.error('[PlaylistsPage] Retrait de piste impossible', error);
        this.actionError.set(this.getErrorMessage(error, 'Retrait de la piste impossible.'));
        this.removingTrackId.set(null);
      },
    });
  }

  playTrack(entry: PlaylistTrack): void {
    const playlist = this.selectedPlaylist();
    if (!playlist) {
      return;
    }
    this.releaseAudio();
    this.audioError.set(null);
    this.currentAudioTrackId.set(entry.track.id);
    this.currentAudioTrackTitle.set(entry.track.title);
    this.audioRequest = this.playlistsApi.audio(playlist.id, entry.track.id).subscribe({
      next: (blob) => this.audioUrl.set(URL.createObjectURL(blob)),
      error: (error) => {
        console.error('[PlaylistsPage] Lecture audio impossible', error);
        this.audioError.set(this.getErrorMessage(error, 'Lecture audio impossible.'));
        this.currentAudioTrackId.set(null);
        this.currentAudioTrackTitle.set(null);
      },
    });
  }

  isOwner(playlist: Playlist): boolean {
    return playlist.owner.id === this.auth.currentUser()?.id;
  }

  private replacePlaylist(playlist: Playlist): void {
    this.selectedPlaylist.set(playlist);
    this.playlists.update((items) =>
      items.map((item) => item.id === playlist.id
        ? { ...item, trackCount: playlist.trackCount, name: playlist.name, visibility: playlist.visibility }
        : item),
    );
    this.selectedTrackId.setValue(this.availableTracks()[0]?.id ?? '');
  }

  private releaseAudio(): void {
    this.audioRequest?.unsubscribe();
    this.audioRequest = undefined;
    const currentUrl = this.audioUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    this.audioUrl.set('');
    this.currentAudioTrackId.set(null);
    this.currentAudioTrackTitle.set(null);
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return fallback;
  }
}
