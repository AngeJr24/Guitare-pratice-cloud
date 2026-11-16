import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { User } from '../../shared/models/user.model';
import { AuthService } from '../../shared/services/auth.service';
import { ProfilePageComponent } from './profile-page';

describe('ProfilePageComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createHarness = () => {
    const user = signal<User>({
      id: 'user-1',
      name: 'Ange',
      email: 'ange@example.com',
      profilePhoto: null,
      createdAt: '2026-11-16T00:00:00.000Z',
    });
    const auth = {
      currentUser: user,
      profile: vi.fn(() => of(user())),
      update: vi.fn(() => of(user())),
      uploadProfilePhoto: vi.fn((file: File) => {
        user.set({
          ...user(),
          profilePhoto: { mimeType: file.type, size: file.size },
        });
        return of(user());
      }),
      profilePhoto: vi.fn(() => of(new Blob(['photo'], { type: 'image/png' }))),
      deleteProfilePhoto: vi.fn(() => {
        user.set({ ...user(), profilePhoto: null });
        return of(undefined);
      }),
    };
    const injector = Injector.create({
      providers: [{ provide: AuthService, useValue: auth }],
    });
    return {
      auth,
      component: runInInjectionContext(
        injector,
        () => new ProfilePageComponent(),
      ),
      injector,
    };
  };

  it('uploads an allowed photo and refreshes the preview', () => {
    const { auth, component, injector } = createHarness();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:profile-photo');
    const photo = new File(['photo'], 'profile.png', { type: 'image/png' });

    component.selectPhoto({
      target: { files: [photo], value: 'profile.png' },
    } as unknown as Event);

    expect(auth.uploadProfilePhoto).toHaveBeenCalledWith(photo);
    expect(auth.profilePhoto).toHaveBeenCalledOnce();
    expect(component.photoUrl()).toBe('blob:profile-photo');
    expect(component.photoSuccess()).toContain('mise à jour');
    injector.destroy();
  });

  it('rejects unsupported image formats before uploading', () => {
    const { auth, component, injector } = createHarness();
    const file = new File(['svg'], 'profile.svg', { type: 'image/svg+xml' });

    component.selectPhoto({
      target: { files: [file], value: 'profile.svg' },
    } as unknown as Event);

    expect(auth.uploadProfilePhoto).not.toHaveBeenCalled();
    expect(component.photoError()).toContain('Formats acceptés');
    injector.destroy();
  });

  it('deletes the current profile photo', () => {
    const { auth, component, injector } = createHarness();

    component.deletePhoto();

    expect(auth.deleteProfilePhoto).toHaveBeenCalledOnce();
    expect(auth.currentUser().profilePhoto).toBeNull();
    expect(component.photoSuccess()).toContain('supprimée');
    injector.destroy();
  });
});
