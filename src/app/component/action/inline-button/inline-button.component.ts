import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-inline-button',
  templateUrl: './inline-button.component.html',
  styleUrls: ['./inline-button.component.scss'],
  host: { 'class': 'action' },
  imports: [LoadingComponent]
})
export class InlineButtonComponent extends ActionComponent {

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
