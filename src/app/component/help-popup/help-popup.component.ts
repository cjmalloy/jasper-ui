import { Component, inject, input, output } from '@angular/core';
import { Store } from '../../store/store';

@Component({
  selector: 'app-help-popup',
  templateUrl: './help-popup.component.html',
  styleUrls: ['./help-popup.component.scss'],
  standalone: true,
})
export class HelpPopupComponent {
  store = inject(Store);

  readonly text = input.required<string>();

  readonly arrowPosition = input<'left' | 'right' | 'top' | 'bottom'>('left');

  readonly nextClick = output<void>();
  readonly previousClick = output<void>();
  readonly doneClick = output<void>();
}
