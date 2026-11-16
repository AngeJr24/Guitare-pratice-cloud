import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createService = (http: object) => {
    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: http }],
    });
    return {
      injector,
      service: runInInjectionContext(injector, () => new AuthService()),
    };
  };

  it('uploads the selected profile photo as multipart form data', () => {
    const user: User = {
      id: 'user-1',
      name: 'Ange',
      email: 'ange@example.com',
      profilePhoto: { mimeType: 'image/png', size: 5 },
      createdAt: '2026-11-16T00:00:00.000Z',
    };
    const post = vi.fn((_url: string, _body: FormData) => of(user));
    const { injector, service } = createService({ post });
    const photo = new File(['photo'], 'profile.png', { type: 'image/png' });
    let response: User | undefined;

    service.uploadProfilePhoto(photo).subscribe((result) => {
      response = result;
    });

    expect(post).toHaveBeenCalledWith(
      '/api/users/me/photo',
      expect.any(FormData),
    );
    const body = post.mock.calls[0]?.[1];
    expect(body.get('photo')).toBe(photo);
    expect(service.currentUser()).toEqual(user);
    expect(response).toEqual(user);
    injector.destroy();
  });

  it('loads and deletes the connected user profile photo', () => {
    const blob = new Blob(['photo'], { type: 'image/png' });
    const get = vi.fn(() => of(blob));
    const deleteRequest = vi.fn(() => of(undefined));
    const { injector, service } = createService({ get, delete: deleteRequest });
    service.currentUser.set({
      id: 'user-1',
      name: 'Ange',
      email: 'ange@example.com',
      profilePhoto: { mimeType: 'image/png', size: 5 },
      createdAt: '2026-11-16T00:00:00.000Z',
    });

    service.profilePhoto().subscribe((result) => {
      expect(result).toBe(blob);
    });
    service.deleteProfilePhoto().subscribe();

    expect(get).toHaveBeenCalledWith('/api/users/me/photo', {
      responseType: 'blob',
    });
    expect(deleteRequest).toHaveBeenCalledWith('/api/users/me/photo');
    expect(service.currentUser()?.profilePhoto).toBeNull();
    injector.destroy();
  });

  it('loads another member profile photo through the authenticated API route', () => {
    const blob = new Blob(['member-photo'], { type: 'image/png' });
    const get = vi.fn(
      (_url: string, _options: { responseType: 'blob' }) => of(blob),
    );
    const { injector, service } = createService({ get });

    service.memberPhoto('member-2').subscribe((result) => {
      expect(result).toBe(blob);
    });

    expect(get).toHaveBeenCalledWith('/api/members/member-2/photo', {
      responseType: 'blob',
    });
    injector.destroy();
  });
});
