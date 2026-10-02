import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { Store } from '../../store/store';

@Component({
  selector: 'app-help-popup',
  templateUrl: './help-popup.component.html',
  styleUrls: ['./help-popup.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPopupComponent {
  @Input()
  text!: string;

  @Input()
  arrowPosition: 'left' | 'right' | 'top' | 'bottom' = 'left';

  @Output()
  nextClick = new EventEmitter<void>();
  @Output()
  previousClick = new EventEmitter<void>();
  @Output()
  doneClick = new EventEmitter<void>();

  constructor(
    public store: Store,
  ) { }
}
