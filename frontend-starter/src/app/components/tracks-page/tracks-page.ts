import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { validateAudioUpload } from '../../shared/services/track-validation';

@Component({
  imports: [ReactiveFormsModule],
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
  readonly listError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<string | null>(null);
  readonly audioUrl = signal('');
  readonly audioError = signal<string | null>(null);
  readonly currentTrackId = signal<string | null>(null);
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

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
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
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    const title = (this.title.value || this.file.name).trim();
    this.service.upload(this.file, title).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
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
        this.uploadError.set(message);
      },
      complete: () => {
        this.uploadLoading.set(false);
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
    const confirmed = window.confirm(`Supprimer la piste "${track.title}" ?`);
    if (!confirmed) {
      return;
    }

    this.listError.set(null);
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

        this.load();
      },
      error: (error) => {
        const message = error?.error?.message || 'Suppression impossible.';
        console.error('[TracksPage] Suppression impossible', error);
        this.listError.set(message);
      },
    });
  }
}
