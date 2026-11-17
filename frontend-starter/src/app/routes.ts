import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { LoginPageComponent } from './components/login-page/login-page';
import { ProfilePageComponent } from './components/profile-page/profile-page';
import { RegisterPageComponent } from './components/register-page/register-page';
import { TracksPageComponent } from './components/tracks-page/tracks-page';
import { CommunityPageComponent } from './components/community-page/community-page';
import { MessagesPageComponent } from './components/messages-page/messages-page';
import { PlaylistsPageComponent } from './components/playlists-page/playlists-page';
import { LibraryPageComponent } from './components/library-page/library-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'community' },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'community', component: CommunityPageComponent, canActivate: [authGuard] },
  { path: 'messages', component: MessagesPageComponent, canActivate: [authGuard] },
  {
    path: 'library',
    component: LibraryPageComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tracks' },
      { path: 'tracks', component: TracksPageComponent },
      { path: 'playlists', component: PlaylistsPageComponent },
    ],
  },
  { path: 'tracks', pathMatch: 'full', redirectTo: '/library/tracks' },
  { path: 'playlists', pathMatch: 'full', redirectTo: '/library/playlists' },
  { path: '**', redirectTo: 'community' },
];
