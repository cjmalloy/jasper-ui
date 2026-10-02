import { Component, ChangeDetectionStrategy, input, signal } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-button',
  templateUrl: './inline-button.component.html',
  styleUrls: ['./inline-button.component.scss'],
  host: { 'class': 'action' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, LoadingComponent]
})
export class InlineButtonComponent extends ActionComponent {

  readonly action = input<() => Observable<any | never>>(() => of(null));
  readonly minDelayMs = input(1000);

  private readonly actingSignal = signal(false);
  private readonly minTimeoutSignal = signal(false);

  get acting() { return this.actingSignal(); }
  set acting(value: boolean) { this.actingSignal.set(value); }

  get minTimeout() { return this.minTimeoutSignal(); }
  set minTimeout(value: boolean) { this.minTimeoutSignal.set(value); }

  override reset() {
    this.acting = false;
  }

  override active() {
    return this.acting;
  }

  act() {
    this.acting = true;
    this.minTimeout = true;
    setTimeout(() => this.minTimeout = false, this.minDelayMs());
    this.action()().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }
}
