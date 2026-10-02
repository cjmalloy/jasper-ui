import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-button',
  templateUrl: './inline-button.component.html',
  styleUrls: ['./inline-button.component.scss'],
  host: { 'class': 'action' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FakeLinkDirective, LoadingComponent]
})
export class InlineButtonComponent extends ActionComponent {

  readonly action = input<() => Observable<any | never>>(() => of(null));
  readonly minDelayMs = input(1000);

  acting = false;
  minTimeout = false;

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
