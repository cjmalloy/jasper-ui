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

  private readonly confirmingSignal = signal(false);
  private readonly actingSignal = signal(false);
  private readonly minTimeoutSignal = signal(false);

  get confirming() { return this.confirmingSignal(); }
  set confirming(value: boolean) { this.confirmingSignal.set(value); }

  get acting() { return this.actingSignal(); }
  set acting(value: boolean) { this.actingSignal.set(value); }

  get minTimeout() { return this.minTimeoutSignal(); }
  set minTimeout(value: boolean) { this.minTimeoutSignal.set(value); }

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
    setTimeout(() => this.minTimeout = false, this.minDelayMs());
    this.action()().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }
}
