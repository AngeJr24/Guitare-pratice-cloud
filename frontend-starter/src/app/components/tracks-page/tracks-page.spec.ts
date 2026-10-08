import '@angular/compiler';
import { HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { TracksPageComponent } from './tracks-page';

describe('TracksPageComponent upload progress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not show 100 percent until the server confirms the saved track', () => {
    const audio = new File(['audio-data'], 'practice.mp3', { type: 'audio/mpeg' });
    const track: Track = {
      id: 'track-123',
      title: 'Practice',
      originalName: audio.name,
      mimeType: audio.type,
      size: audio.size,
      createdAt: '2026-10-08T00:00:00.000Z',
    };
    const uploadEvents = new Subject<HttpEvent<Track>>();
    const service = {
      list: vi.fn(() => of({ items: [], page: 1, limit: 5, total: 0, pages: 1 })),
      upload: vi.fn(() => uploadEvents.asObservable()),
    };
    const injector = Injector.create({
      providers: [{ provide: TrackService, useValue: service }],
    });

    vi.stubGlobal('document', { getElementById: vi.fn(() => null) });
    const component = runInInjectionContext(injector, () => new TracksPageComponent());
    component.file = audio;
    component.upload();

    uploadEvents.next({
      type: HttpEventType.UploadProgress,
      loaded: 100,
      total: 100,
    });
    expect(component.uploadProgress()).toBe(99);
    expect(component.uploadSuccess()).toBeNull();
    expect(component.uploadLoading()).toBe(true);
    expect(component.title.disabled).toBe(true);

    uploadEvents.next(new HttpResponse<Track>({
      body: track,
      status: 201,
    }));
    expect(component.uploadProgress()).toBe(100);
    expect(component.uploadSuccess()).toBe('Piste ajoutée avec succès.');

    uploadEvents.complete();
    expect(component.uploadLoading()).toBe(false);
    expect(component.title.enabled).toBe(true);
    injector.destroy();
  });

  it('shows an upload error and unlocks the form when the request fails', () => {
    const audio = new File(['audio-data'], 'practice.mp3', { type: 'audio/mpeg' });
    const service = {
      list: vi.fn(() => of({ items: [], page: 1, limit: 5, total: 0, pages: 1 })),
      upload: vi.fn(() => throwError(() => new Error('Network unavailable'))),
    };
    const injector = Injector.create({
      providers: [{ provide: TrackService, useValue: service }],
    });

    const component = runInInjectionContext(injector, () => new TracksPageComponent());
    component.file = audio;
    component.upload();

    expect(component.uploadError()).toBe('Impossible d’envoyer ce fichier audio.');
    expect(component.uploadProgress()).toBeNull();
    expect(component.uploadLoading()).toBe(false);
    expect(component.title.enabled).toBe(true);
    injector.destroy();
  });

  it('deletes the selected track and reloads the list after confirmation', () => {
    const track: Track = {
      id: 'track-123',
      title: 'Practice',
      originalName: 'practice.mp3',
      mimeType: 'audio/mpeg',
      size: 10,
      createdAt: '2026-10-08T00:00:00.000Z',
    };
    const page = { items: [track], page: 1, limit: 5, total: 1, pages: 1 };
    const service = {
      list: vi.fn(() => of(page)),
      delete: vi.fn(() => of(undefined)),
    };
    const injector = Injector.create({
      providers: [{ provide: TrackService, useValue: service }],
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const component = runInInjectionContext(injector, () => new TracksPageComponent());

    component.deleteTrack(track);

    expect(confirm).toHaveBeenCalledWith('Supprimer la piste "Practice" ?');
    expect(service.delete).toHaveBeenCalledWith('track-123');
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(component.snackBar()?.kind).toBe('success');
    expect(component.snackBar()?.message).toContain('a été supprimée');

    component.dismissSnackBar();
    injector.destroy();
  });
});
