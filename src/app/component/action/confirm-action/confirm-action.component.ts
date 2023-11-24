import { Component, Input } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-confirm-action',
  templateUrl: './confirm-action.component.html',
  styleUrls: ['./confirm-action.component.scss']
})
export class ConfirmActionComponent extends ActionComponent {

  @Input()
  action: () => Observable<any|never> = () => of(null);

  confirming = false;
  acting = false;

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
    this.action().pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }
}
