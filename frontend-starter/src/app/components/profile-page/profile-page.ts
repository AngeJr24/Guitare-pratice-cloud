import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  readonly photoUrl = signal<string | null>(null);
  readonly photoLoading = signal(false);
  readonly photoUploading = signal(false);
  readonly photoDeleting = signal(false);
  readonly photoError = signal('');
  readonly photoSuccess = signal('');
  readonly profileError = signal('');
  readonly profileSuccess = signal('');
  readonly photoMaxSize = 5 * 1024 * 1024;
  private photoObjectUrl: string | null = null;
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.form.setValue({ name: user.name });
        if (user.profilePhoto) {
          this.loadPhoto();
        } else {
          this.clearPhotoUrl();
        }
      },
      error: (error) => {
        console.error('[ProfilePage] Chargement impossible', error);
        this.profileError.set(
          error.error?.message ?? 'Impossible de charger le profil.',
        );
      },
    });
  }

  save(): void {
    this.profileError.set('');
    this.profileSuccess.set('');
    this.auth.update(this.form.getRawValue().name).subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil enregistré', user.id);
        this.profileSuccess.set('Profil enregistré.');
      },
      error: (error) => {
        console.error('[ProfilePage] Enregistrement impossible', error);
        this.profileError.set(
          error.error?.message ?? 'Impossible d’enregistrer le profil.',
        );
      },
    });
  }

  selectPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.photoError.set('Formats acceptés : JPEG, PNG et WebP.');
      return;
    }
    if (file.size > this.photoMaxSize) {
      this.photoError.set('La photo ne doit pas dépasser 5 Mo.');
      return;
    }

    this.photoError.set('');
    this.photoSuccess.set('');
    this.photoUploading.set(true);
    this.auth.uploadProfilePhoto(file).subscribe({
      next: () => {
        this.photoUploading.set(false);
        this.photoSuccess.set('Photo de profil mise à jour.');
        this.loadPhoto();
      },
      error: (error) => {
        console.error('[ProfilePage] Envoi de la photo impossible', error);
        this.photoError.set(
          error.error?.message ?? 'Impossible d’enregistrer la photo.',
        );
        this.photoUploading.set(false);
      },
    });
  }

  loadPhoto(): void {
    this.photoLoading.set(true);
    this.auth.profilePhoto().subscribe({
      next: (blob) => {
        this.clearPhotoUrl();
        this.photoObjectUrl = URL.createObjectURL(blob);
        this.photoUrl.set(this.photoObjectUrl);
        this.photoLoading.set(false);
      },
      error: (error) => {
        console.error('[ProfilePage] Chargement de la photo impossible', error);
        this.photoError.set(
          error.error?.message ?? 'Impossible de charger la photo de profil.',
        );
        this.photoLoading.set(false);
      },
    });
  }

  deletePhoto(): void {
    this.photoError.set('');
    this.photoSuccess.set('');
    this.photoDeleting.set(true);
    this.auth.deleteProfilePhoto().subscribe({
      next: () => {
        this.clearPhotoUrl();
        this.photoSuccess.set('Photo de profil supprimée.');
        this.photoDeleting.set(false);
      },
      error: (error) => {
        console.error('[ProfilePage] Suppression de la photo impossible', error);
        this.photoError.set(
          error.error?.message ?? 'Impossible de supprimer la photo de profil.',
        );
        this.photoDeleting.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.clearPhotoUrl();
  }

  private clearPhotoUrl(): void {
    if (this.photoObjectUrl) {
      URL.revokeObjectURL(this.photoObjectUrl);
      this.photoObjectUrl = null;
    }
    this.photoUrl.set(null);
  }
}
