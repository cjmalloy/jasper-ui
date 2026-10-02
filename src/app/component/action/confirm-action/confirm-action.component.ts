import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-confirm-action',
  templateUrl: './confirm-action.component.html',
  styleUrls: ['./confirm-action.component.scss'],
  host: { 'class': 'action' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, LoadingComponent]
})
export class ConfirmActionComponent extends ActionComponent {

  readonly message = input($localize `are you sure?`);
  readonly warning = input('');
  readonly action = input<() => Observable<any | never>>(() => of(null));
  readonly minDelayMs = input(1000);

  readonly confirming = signal(false);
  readonly acting = signal(false);
  readonly minTimeout = signal(false);

  override reset() {
    this.confirming.set(false);
    this.acting.set(false);
  }

  override active() {
    return this.confirming() || this.acting();
  }

  confirm() {
    this.confirming.set(false);
    this.acting.set(true);
    this.minTimeout.set(true);
    setTimeout(() => this.minTimeout.set(false), this.minDelayMs());
    this.action()().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }
}
