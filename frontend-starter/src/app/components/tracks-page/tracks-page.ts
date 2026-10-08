import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { SnackBarComponent } from '../../shared/components/snack-bar/snack-bar';
import { TrackService } from '../../shared/services/track.service';
import { validateAudioUpload } from '../../shared/services/track-validation';

type SnackBarKind = 'success' | 'error';

@Component({
  imports: [ReactiveFormsModule, SnackBarComponent],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent implements OnDestroy {
  private readonly service = inject(TrackService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly uploadLoading = signal(false);
  readonly uploadProgress = signal<number | null>(null);
  readonly listError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<string | null>(null);
  readonly audioUrl = signal('');
  readonly audioError = signal<string | null>(null);
  readonly currentTrackId = signal<string | null>(null);
  readonly deletingTrackId = signal<string | null>(null);
  readonly snackBar = signal<{ message: string; kind: SnackBarKind } | null>(null);
  readonly filter = signal('');
  readonly filteredTracks = computed(() => {
    const query = this.filter().trim().toLowerCase();
    const items = this.tracks();

    if (!query) {
      return items;
    }

    return items.filter((track) => {
      const title = track.title.toLowerCase();
      const originalName = track.originalName.toLowerCase();
      return title.includes(query) || originalName.includes(query);
    });
  });
  readonly title = new FormControl('', { nonNullable: true });
  file?: File;
  private snackBarTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.snackBarTimer) {
      clearTimeout(this.snackBarTimer);
    }

    const previousUrl = this.audioUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }
  }

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0];
    const validationError = validateAudioUpload(selected);

    this.file = selected;
    this.uploadError.set(null);
    this.uploadSuccess.set(null);
    this.uploadProgress.set(null);

    if (selected && validationError) {
      this.file = undefined;
      input.value = '';
      this.uploadError.set(validationError);
      console.warn('[TracksPage] Fichier invalide au choix', validationError);
      return;
    }

    console.debug('[TracksPage] Fichier sélectionné', selected?.name);
  }

  load(): void {
    this.loading.set(true);
    this.listError.set(null);
    this.service.list(this.page()).subscribe({
      next: (response) => {
        if (this.page() > response.pages) {
          this.page.set(response.pages);
          this.load();
          return;
        }

        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.loading.set(false);
      },
      error: (error) => {
        const message = error?.error?.message || 'Chargement impossible. Réessayez plus tard.';
        console.error('[TracksPage] Chargement impossible', error);
        this.listError.set(message);
        this.loading.set(false);
      },
    });
  }

  go(page: number): void {
    const nextPage = Math.min(Math.max(1, page), this.pages());
    if (nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.load();
  }

  upload(): void {
    if (!this.file) {
      this.uploadError.set('Un fichier audio est requis.');
      return;
    }

    const validationError = validateAudioUpload(this.file);
    if (validationError) {
      this.uploadError.set(validationError);
      return;
    }

    this.uploadLoading.set(true);
    this.title.disable({ emitEvent: false });
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    const title = (this.title.value || this.file.name).trim();
    let serverConfirmedUpload = false;
    this.service.upload(this.file, title).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          if (event.total && event.total > 0) {
            const percentage = Math.floor((event.loaded / event.total) * 100);
            this.uploadProgress.set(Math.min(99, percentage));
          } else {
            this.uploadProgress.set(null);
          }
          return;
        }

        if (event.type !== HttpEventType.Response) {
          return;
        }

        const track = event.body;
        if (event.status !== 201 || !track?.id) {
          this.uploadProgress.set(null);
          this.uploadError.set('Le serveur n’a pas confirmé l’enregistrement de la piste.');
          return;
        }

        serverConfirmedUpload = true;
        this.uploadProgress.set(100);
        console.debug('[TracksPage] Piste enregistrée', track.id);
        const input = document.getElementById('track-file-input') as HTMLInputElement | null;
        if (input) {
          input.value = '';
        }
        this.title.setValue('');
        this.file = undefined;
        this.uploadSuccess.set('Piste ajoutée avec succès.');
        this.page.set(1);
        this.load();
      },
      error: (error) => {
        const message = error?.error?.message || 'Impossible d’envoyer ce fichier audio.';
        console.error('[TracksPage] Envoi impossible', error);
        this.uploadProgress.set(null);
        this.uploadError.set(message);
        this.uploadLoading.set(false);
        this.title.enable({ emitEvent: false });
      },
      complete: () => {
        if (!serverConfirmedUpload && !this.uploadError()) {
          this.uploadProgress.set(null);
          this.uploadError.set('L’envoi est terminé sans confirmation d’enregistrement du serveur.');
        }
        this.uploadLoading.set(false);
        this.title.enable({ emitEvent: false });
      },
    });
  }

  play(track: Track): void {
    const previousUrl = this.audioUrl();
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
    }

    this.currentTrackId.set(track.id);
    this.audioError.set(null);
    this.audioUrl.set('');

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error) => {
        const message = error?.error?.message || 'Lecture impossible. Vérifiez votre accès au fichier.';
        console.error('[TracksPage] Lecture impossible', error);
        this.audioError.set(message);
        this.currentTrackId.set(null);
      },
    });
  }

  deleteTrack(track: Track): void {
    if (this.deletingTrackId()) {
      return;
    }

    const confirmed = window.confirm(`Supprimer la piste "${track.title}" ?`);
    if (!confirmed) {
      return;
    }

    this.deletingTrackId.set(track.id);
    this.service.delete(track.id).subscribe({
      next: () => {
        if (this.currentTrackId() === track.id) {
          const previousUrl = this.audioUrl();
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          this.audioUrl.set('');
          this.currentTrackId.set(null);
          this.audioError.set(null);
        }

        this.deletingTrackId.set(null);
        this.showSnackBar(`La piste « ${track.title} » a été supprimée.`, 'success');
        this.load();
      },
      error: (error) => {
        console.error('[TracksPage] Suppression impossible', error);
        this.deletingTrackId.set(null);
        this.showSnackBar(this.getDeleteErrorMessage(error), 'error');
        this.load();
      },
    });
  }

  dismissSnackBar(): void {
    this.snackBar.set(null);
    if (this.snackBarTimer) {
      clearTimeout(this.snackBarTimer);
      this.snackBarTimer = undefined;
    }
  }

  private showSnackBar(message: string, kind: SnackBarKind): void {
    if (this.snackBarTimer) {
      clearTimeout(this.snackBarTimer);
    }

    this.snackBar.set({ message, kind });
    this.snackBarTimer = setTimeout(() => {
      this.snackBar.set(null);
      this.snackBarTimer = undefined;
    }, 5000);
  }

  private getDeleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        return 'Cette piste n’est plus disponible ou vous n’êtes pas autorisé à la supprimer.';
      }
      if (error.status === 401) {
        return 'Votre session n’est plus valide. Reconnectez-vous avant de supprimer une piste.';
      }

      const apiMessage = error.error?.message;
      if (typeof apiMessage === 'string') {
        return apiMessage;
      }
    }

    return 'Suppression impossible. Réessayez plus tard.';
  }
}
