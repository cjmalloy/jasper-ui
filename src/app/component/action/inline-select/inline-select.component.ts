import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-select',
  templateUrl: './inline-select.component.html',
  styleUrls: ['./inline-select.component.scss'],
  host: { 'class': 'action' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FakeLinkDirective, LoadingComponent]
})
export class InlineSelectComponent extends ActionComponent {

  readonly action = input<(value: any) => Observable<any | never>>(() => of(null));
  readonly value = input<any>();
  readonly error = output<string>();

  readonly editing = signal(false);
  readonly acting = signal(false);



  override reset() {
    this.editing.set(false);
    this.acting.set(false);
  }

  override active() {
    return this.editing() || this.acting();
  }

  save(field: HTMLSelectElement) {
    this.editing.set(false);
    this.acting.set(true);
    this.action()((field.value || '').trim()).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }

}
