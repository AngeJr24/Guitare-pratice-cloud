import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../shared/services/auth.service';
import { CommunityService } from '../../shared/services/community.service';
import { CommunityPageComponent } from './community-page';

describe('CommunityPageComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the form text when the user submits a publication', async () => {
    const service = {
      list: vi.fn(() =>
        of({ items: [], page: 1, limit: 10, total: 0, pages: 1 }),
      ),
      create: vi.fn(() =>
        of({
          id: 'post-1',
          author: { id: 'user-1', name: 'Ange' },
          content: 'Découverte musicale',
          visibility: 'public' as const,
          createdAt: '2026-10-14T00:00:00.000Z',
        }),
      ),
      update: vi.fn(),
      delete: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommunityPageComponent],
      providers: [
        { provide: CommunityService, useValue: service },
        {
          provide: AuthService,
          useValue: { currentUser: signal({ id: 'user-1', name: 'Ange' }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommunityPageComponent);
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('#post-content');
    textarea.value = '  Découverte musicale  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(service.create).toHaveBeenCalledWith(
      'Découverte musicale',
      'public',
    );
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(textarea.value).toBe('');
    fixture.destroy();
  });

  it('updates a post with the selected visibility', async () => {
    const post = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'Avant',
      visibility: 'public' as const,
      createdAt: '2026-10-14T00:00:00.000Z',
    };
    const service = {
      list: vi.fn(() =>
        of({ items: [post], page: 1, limit: 10, total: 1, pages: 1 }),
      ),
      create: vi.fn(),
      update: vi.fn(() => of({ ...post, content: 'Après', visibility: 'private' as const })),
      delete: vi.fn(),
    };
    const auth = { currentUser: signal({ id: 'user-1', name: 'Ange' }) };

    await TestBed.configureTestingModule({
      imports: [CommunityPageComponent],
      providers: [
        { provide: CommunityService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommunityPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.startEditing(post);
    component.editContent.setValue(' Après ');
    component.editVisibility.setValue('private');
    component.saveEdit(post);

    expect(service.update).toHaveBeenCalledWith('post-1', 'Après', 'private');
    expect(component.posts()[0].content).toBe('Après');
    expect(component.posts()[0].visibility).toBe('private');
    expect(component.actionSuccess()).toBe('Publication modifiée.');
    fixture.destroy();
  });

  it('deletes an owned post after confirmation', async () => {
    const post = {
      id: 'post-1',
      author: { id: 'user-1', name: 'Ange' },
      content: 'À supprimer',
      visibility: 'public' as const,
      createdAt: '2026-10-14T00:00:00.000Z',
    };
    const service = {
      list: vi.fn(() =>
        of({ items: [post], page: 1, limit: 10, total: 1, pages: 1 }),
      ),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(() => of(undefined)),
    };
    const auth = { currentUser: signal({ id: 'user-1', name: 'Ange' }) };
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [CommunityPageComponent],
      providers: [
        { provide: CommunityService, useValue: service },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommunityPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.deletePost(post);

    expect(service.delete).toHaveBeenCalledWith('post-1');
    expect(component.posts()).toEqual([]);
    expect(component.actionSuccess()).toBe('Publication supprimée.');
    fixture.destroy();
  });
});
