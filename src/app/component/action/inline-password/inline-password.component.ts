import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { ActionComponent } from '../action.component';

@Component({
  standalone: false,
  selector: 'app-inline-password',
  templateUrl: './inline-password.component.html',
  styleUrls: ['./inline-password.component.scss']
})
export class InlinePasswordComponent extends ActionComponent {
  @HostBinding('class') css = 'action';

  @Input()
  action: (password: string) => Observable<any|never> = () => of(null);
  @Output()
  error = new EventEmitter<string>();

  editing = false;
  acting = false;

  override reset() {
    this.editing = false;
    this.acting = false;
  }

  override active() {
    return this.editing || this.acting;
  }

  save(field: HTMLInputElement) {
    const password = (field.value || '').trim();
    if (!password) {
      this.editing = false;
      return;
    }
    this.editing = false;
    this.acting = true;
    this.action(password).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

}
