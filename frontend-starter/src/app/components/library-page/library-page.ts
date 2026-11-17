import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './library-page.html',
  styleUrl: './library-page.css',
})
export class LibraryPageComponent {}
