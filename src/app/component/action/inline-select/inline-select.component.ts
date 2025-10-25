import { Component, EventEmitter, Input, Output } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-select',
  templateUrl: './inline-select.component.html',
  styleUrls: ['./inline-select.component.scss'],
  host: { 'class': 'action' },
  imports: [LoadingComponent]
})
export class InlineSelectComponent extends ActionComponent {

  @Input()
  action: (value: any) => Observable<any|never> = () => of(null);
  @Input()
  value?: any;
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

  save(field: HTMLSelectElement) {
    this.editing = false;
    this.acting = true;
    this.action((field.value || '').trim()).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

}
