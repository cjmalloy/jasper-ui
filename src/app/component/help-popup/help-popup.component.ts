import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Store } from '../../store/store';

@Component({
  selector: 'app-help-popup',
  templateUrl: './help-popup.component.html',
  styleUrls: ['./help-popup.component.scss'],
  standalone: false
})
export class HelpPopupComponent {
  @Input()
  id!: string;
  @Input()
  text!: string;

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
