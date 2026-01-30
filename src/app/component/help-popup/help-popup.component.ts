import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MobxAngularModule } from 'mobx-angular';
import { Store } from '../../store/store';

@Component({
  selector: 'app-help-popup',
  templateUrl: './help-popup.component.html',
  styleUrls: ['./help-popup.component.scss'],
  standalone: true,
  imports: [MobxAngularModule]
})
export class HelpPopupComponent {
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
