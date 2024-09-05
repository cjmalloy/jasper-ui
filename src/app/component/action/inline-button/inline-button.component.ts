import { Component, HostBinding, Input } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-button',
  templateUrl: './inline-button.component.html',
  styleUrls: ['./inline-button.component.scss']
})
export class InlineButtonComponent extends ActionComponent {
  @HostBinding('class') css = 'action';

  @Input()
  action: () => Observable<any|never> = () => of(null);
  @Input()
  minDelayMs = 1000;

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
    setTimeout(() => this.minTimeout = false, this.minDelayMs);
    this.action().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }
}
