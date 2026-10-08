import '@angular/compiler';
import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';
import { TrackService } from './track.service';

describe('TrackService upload progress', () => {
  it('sends the requested page and limit to the tracks endpoint', () => {
    const page: Page<Track> = { items: [], page: 3, limit: 7, total: 20, pages: 3 };
    const get = vi.fn(() => of(page));
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { get } }],
    });
    const service = runInInjectionContext(injector, () => new TrackService());
    let result: Page<Track> | undefined;

    service.list(3, 7).subscribe((response) => {
      result = response;
    });

    expect(get).toHaveBeenCalledWith('/api/tracks', {
      params: { page: 3, limit: 7 },
    });
    expect(result).toEqual(page);
    injector.destroy();
  });

  it('requests upload progress and emits progress before the saved track response', () => {
    const audio = new File(['audio-data'], 'practice.mp3', { type: 'audio/mpeg' });
    const track: Track = {
      id: 'track-123',
      title: 'Practice',
      originalName: audio.name,
      mimeType: audio.type,
      size: audio.size,
      createdAt: '2026-10-08T00:00:00.000Z',
    };
    const responseEvents = new Subject<HttpEvent<Track>>();
    const post = vi.fn(
      (
        _url: string,
        _body: unknown,
        _options: { observe: 'events'; reportUploadProgress: boolean },
      ) => responseEvents.asObservable(),
    );
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: { post } }],
    });
    const service = runInInjectionContext(injector, () => new TrackService());
    const events: HttpEvent<Track>[] = [];

    service.upload(audio, 'Practice').subscribe((event) => events.push(event));

    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith(
      '/api/tracks',
      expect.any(FormData),
      { observe: 'events', reportUploadProgress: true },
    );
    const formData = post.mock.calls[0][1];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error('L’upload doit utiliser un formulaire multipart.');
    }
    expect(formData.get('audio')).toBe(audio);
    expect(formData.get('title')).toBe('Practice');

    responseEvents.next({
      type: HttpEventType.UploadProgress,
      loaded: 5,
      total: 10,
    });
    responseEvents.next(new HttpResponse<Track>({
      body: track,
      status: 201,
    }));

    expect(events.map((event) => event.type)).toEqual([
      HttpEventType.UploadProgress,
      HttpEventType.Response,
    ]);
    const response = events[1];
    if (response.type === HttpEventType.Response) {
      expect(response.status).toBe(201);
      expect(response.body).toEqual(track);
    }

    injector.destroy();
  });
});
