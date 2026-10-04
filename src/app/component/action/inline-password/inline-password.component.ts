import { Component, input, output, signal } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { catchError, Observable, of } from 'rxjs';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { LoadingComponent } from '../../loading/loading.component';

@Component({
  selector: 'app-inline-password',
  templateUrl: './inline-password.component.html',
  styleUrls: ['./inline-password.component.scss'],
  host: { 'class': 'action' },
  imports: [FakeLinkDirective, AutofocusDirective, LoadingComponent]
})
export class InlinePasswordComponent {

  readonly action = input<(password: string) => Observable<any | never>>(() => of(null));
  readonly error = output<string>();

  readonly editing = signal(false);
  readonly acting = signal(false);

  save(field: HTMLInputElement) {
    const password = (field.value || '').trim();
    if (!password) {
      this.editing.set(false);
      return;
    }
    this.editing.set(false);
    this.acting.set(true);
    this.action()(password).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }

}
