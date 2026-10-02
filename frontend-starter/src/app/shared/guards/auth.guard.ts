import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Protects routes that require a token issued by the API. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token() ?? localStorage.getItem('gpc_token');
  if (token) {
    auth.token.set(token);
    return true;
  }

  return router.createUrlTree(['/login']);
};
