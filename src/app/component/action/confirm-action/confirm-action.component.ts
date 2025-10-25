import { Component, Input } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-confirm-action',
  templateUrl: './confirm-action.component.html',
  styleUrls: ['./confirm-action.component.scss'],
  host: { 'class': 'action' },
  imports: [LoadingComponent]
})
export class ConfirmActionComponent extends ActionComponent {

  @Input()
  message = $localize`are you sure?`;
  @Input()
  warning = '';
  @Input()
  action: () => Observable<any|never> = () => of(null);
  @Input()
  minDelayMs = 1000;

  confirming = false;
  acting = false;
  minTimeout = false;

  override reset() {
    this.confirming = false;
    this.acting = false;
  }

  override active() {
    return this.confirming || this.acting;
  }

  confirm() {
    this.confirming = false;
    this.acting = true;
    this.minTimeout = true;
    setTimeout(() => this.minTimeout = false, this.minDelayMs);
    this.action().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }
}
