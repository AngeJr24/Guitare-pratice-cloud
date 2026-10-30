import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { EMPTY, catchError, switchMap, timer } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { MessagingService } from '../../shared/services/messaging.service';

type AppTheme = 'dark' | 'light' | 'grey';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly messaging = inject(MessagingService);
  private readonly router = inject(Router);
  readonly theme = signal<AppTheme>(this.loadTheme());

  constructor() {
    this.auth.restoreSession();
    this.applyTheme(this.theme());
    effect((onCleanup) => {
      if (!this.auth.token()) {
        this.messaging.clearUnreadCounts();
        return;
      }

      const subscription = timer(0, 15000)
        .pipe(
          switchMap(() =>
            this.messaging.refreshUnreadCounts().pipe(
              catchError(() => EMPTY),
            ),
          ),
        )
        .subscribe();

      onCleanup(() => subscription.unsubscribe());
    });
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    this.applyTheme(theme);
  }

  private loadTheme(): AppTheme {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const storedTheme = window.localStorage.getItem('gpc-theme');
    return storedTheme === 'light' || storedTheme === 'grey' ? storedTheme : 'dark';
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.body.classList.remove('theme-dark', 'theme-light', 'theme-grey');
    document.body.classList.add(`theme-${theme}`);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gpc-theme', theme);
    }
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
