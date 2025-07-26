import { AfterViewInit, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, UntypedFormGroup } from '@angular/forms';
import { catchError, Observable, of } from 'rxjs';
import { pluginsForm } from '../../../form/plugins/plugins.component';
import { Plugin } from '../../../model/plugin';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ActionComponent } from '../action.component';

@Component({
  standalone: false,
  selector: 'app-inline-plugin',
  templateUrl: './inline-plugin.component.html',
  styleUrls: ['./inline-plugin.component.scss'],
  host: {'class': 'action'}
})
export class InlinePluginComponent extends ActionComponent implements AfterViewInit {

  @Input()
  action: (plugins: any) => Observable<any|never> = () => of(null);
  @Input()
  plugin!: Plugin;
  @Input()
  value?: Ref;
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

  ngAfterViewInit() {
    this.group = pluginsForm(this.fb, this.admin, [this.plugin.tag]);
    this.group.patchValue(this.value?.plugins || {});
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
