import { Component, input, output } from '@angular/core';

export type SnackBarKind = 'success' | 'error';

@Component({
  selector: 'app-snack-bar',
  templateUrl: './snack-bar.html',
  styleUrl: './snack-bar.css',
})
export class SnackBarComponent {
  readonly message = input.required<string>();
  readonly kind = input.required<SnackBarKind>();
  readonly dismissed = output<void>();
}
