import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { catchError, Observable, of } from 'rxjs';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-password',
  templateUrl: './inline-password.component.html',
  styleUrls: ['./inline-password.component.scss'],
  host: { 'class': 'action' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, AutofocusDirective, LoadingComponent]
})
export class InlinePasswordComponent extends ActionComponent {

  readonly action = input<(password: string) => Observable<any | never>>(() => of(null));
  readonly error = output<string>();

  private readonly editingSignal = signal(false);
  private readonly actingSignal = signal(false);

  get editing() { return this.editingSignal(); }
  set editing(value: boolean) { this.editingSignal.set(value); }

  get acting() { return this.actingSignal(); }
  set acting(value: boolean) { this.actingSignal.set(value); }

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
    this.action()(password).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

}
