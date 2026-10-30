import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, catchError, switchMap, timer } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { MessagingService } from '../../shared/services/messaging.service';
import { DirectMessage, SocialMember } from '../../shared/models/messaging.model';

@Component({
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.css',
})
export class MessagesPageComponent {
  readonly service = inject(MessagingService);
  private readonly auth = inject(AuthService);

  readonly members = signal<SocialMember[]>([]);
  readonly selectedMember = signal<SocialMember | null>(null);
  readonly messages = signal<DirectMessage[]>([]);
  readonly loadingMembers = signal(false);
  readonly loadingConversation = signal(false);
  readonly sending = signal(false);
  readonly pageError = signal('');
  readonly sendError = signal('');
  readonly content = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });
  readonly form = new FormGroup({ content: this.content });
  readonly currentUserId = () => this.auth.currentUser()?.id ?? '';

  constructor() {
    this.loadMembers();
    effect((onCleanup) => {
      const member = this.selectedMember();
      if (!member) {
        return;
      }

      const subscription = timer(15000, 15000)
        .pipe(
          switchMap(() =>
            this.service.conversation(member.id).pipe(
              catchError((error: unknown) => {
                console.error('[MessagesPage] Actualisation impossible', error);
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe((conversation) => {
          this.messages.set(conversation.items);
          this.refreshUnreadCounts();
        });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  loadMembers(): void {
    this.loadingMembers.set(true);
    this.pageError.set('');
    this.service.members().subscribe({
      next: (members) => {
        this.members.set(members);
        this.loadingMembers.set(false);
      },
      error: (error) => {
        console.error('[MessagesPage] Chargement des membres impossible', error);
        this.pageError.set(error.error?.message ?? 'Impossible de charger les membres.');
        this.loadingMembers.set(false);
      },
    });
  }

  selectMember(member: SocialMember): void {
    this.selectedMember.set(member);
    this.messages.set([]);
    this.loadingConversation.set(true);
    this.sendError.set('');
    this.service.conversation(member.id).subscribe({
      next: (conversation) => {
        this.selectedMember.set(conversation.member);
        this.messages.set(conversation.items);
        this.loadingConversation.set(false);
        this.refreshUnreadCounts();
      },
      error: (error) => {
        console.error('[MessagesPage] Chargement de la conversation impossible', error);
        this.pageError.set(error.error?.message ?? 'Impossible de charger cette conversation.');
        this.loadingConversation.set(false);
      },
    });
  }

  private refreshUnreadCounts(): void {
    this.service.refreshUnreadCounts().subscribe({
      error: (error) => {
        console.error('[MessagesPage] Actualisation des compteurs impossible', error);
      },
    });
  }

  send(): void {
    const member = this.selectedMember();
    const content = this.content.value.trim();
    if (!member || !content || content.length > 2000 || this.sending()) {
      this.content.setValue(content);
      this.content.markAsTouched();
      return;
    }

    this.sending.set(true);
    this.sendError.set('');
    this.service.send(member.id, content).subscribe({
      next: (message) => {
        this.messages.update((messages) => [...messages, message]);
        this.content.reset('');
        this.sending.set(false);
      },
      error: (error) => {
        console.error('[MessagesPage] Envoi du message impossible', error);
        this.sendError.set(error.error?.message ?? 'Impossible d’envoyer le message.');
        this.sending.set(false);
      },
    });
  }
}
