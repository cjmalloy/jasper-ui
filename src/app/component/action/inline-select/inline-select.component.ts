import { Component, input, output, signal } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { LoadingComponent } from '../../loading/loading.component';

@Component({
  selector: 'app-inline-select',
  templateUrl: './inline-select.component.html',
  styleUrls: ['./inline-select.component.scss'],
  host: { 'class': 'action' },
  imports: [FakeLinkDirective, LoadingComponent]
})
export class InlineSelectComponent {

  readonly action = input<(value: any) => Observable<any | never>>(() => of(null));
  readonly value = input<any>();
  readonly error = output<string>();

  readonly editing = signal(false);
  readonly acting = signal(false);

  save(field: HTMLSelectElement) {
    this.editing.set(false);
    this.acting.set(true);
    this.action()((field.value || '').trim()).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting.set(false));
  }

}
