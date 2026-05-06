import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormGroup } from '@angular/forms';
import { defer } from 'lodash-es';
import { catchError, Observable, of } from 'rxjs';
import { GenFormComponent } from '../../../form/plugins/gen/gen.component';
import { Plugin } from '../../../model/plugin';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { LoadingComponent } from '../../loading/loading.component';
import { ActionComponent } from '../action.component';

@Component({
  selector: 'app-inline-plugin',
  templateUrl: './inline-plugin.component.html',
  styleUrls: ['./inline-plugin.component.scss'],
  host: { 'class': 'action' },
  imports: [GenFormComponent, LoadingComponent]
})
export class InlinePluginComponent extends ActionComponent {

  @Input()
  action: (plugins: any) => Observable<any|never> = () => of(null);
  @Input()
  plugin!: Plugin;
  @Input()
  value?: Partial<Ref>;
  @Output()
  error = new EventEmitter<string>();

  editing = false;
  acting = false;

  group: UntypedFormGroup = this.fb.group({});

  constructor(
    public admin: AdminService,
    private fb: FormBuilder,
  ) {
    super();
  }

  @ViewChild('gen')
  set gen(c: GenFormComponent) {
    if (!c) return;
    this.group = this.fb.group({
      [this.plugin.tag]: this.fb.group({}),
    });
    defer(() => c.setValue(this.value?.plugins || {}));
  }

  override reset() {
    this.editing = false;
    this.acting = false;
  }

  override active() {
    return this.editing || this.acting;
  }

  save() {
    this.editing = false;
    this.acting = true;
    this.action(this.group.value).pipe(
      catchError(() => of(null)),
    ).subscribe(() => this.acting = false);
  }

}
