import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Store } from '../../store/store';

@Component({
  selector: 'app-help-popup',
  templateUrl: './help-popup.component.html',
  styleUrls: ['./help-popup.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPopupComponent {
  readonly text = input.required<string>();

  readonly arrowPosition = input<'left' | 'right' | 'top' | 'bottom'>('left');

  readonly nextClick = output<void>();
  readonly previousClick = output<void>();
  readonly doneClick = output<void>();

  constructor(
    public store: Store,
  ) { }
}
