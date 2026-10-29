import { Component, input, signal } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { LoadingComponent } from '../../loading/loading.component';

@Component({
  selector: 'app-inline-button',
  templateUrl: './inline-button.component.html',
  styleUrls: ['./inline-button.component.scss'],
  host: { 'class': 'action' },
  imports: [FakeLinkDirective, LoadingComponent]
})
export class InlineButtonComponent {

  readonly action = input<() => Observable<any | never>>(() => of(null));
  readonly minDelayMs = input(1000);

  readonly acting = signal(false);
  readonly minTimeout = signal(false);

  act() {
    this.acting.set(true);
    this.minTimeout.set(true);
    setTimeout(() => this.minTimeout.set(false), this.minDelayMs());
    this.action()().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }
}
