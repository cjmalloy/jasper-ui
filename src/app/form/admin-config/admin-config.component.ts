import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyForm, FormlyFormOptions } from '@ngx-formly/core';
import { AdminService } from '../../service/admin.service';

/**
 * Formly editor for a JSON string form control.
 */
@Component({
  selector: 'app-admin-config',
  templateUrl: './admin-config.component.html',
  styleUrls: ['./admin-config.component.scss'],
  host: { 'class': 'nested-form admin-config' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormlyForm],
})
export class AdminConfigComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'config';
  @Input()
  fields: FormlyFieldConfig[] = [];

  form = new UntypedFormGroup({});
  model: any = {};
  options: FormlyFormOptions = {
    formState: {
      admin: this.admin,
      config: this.model,
    },
  };

  private json?: string;

  constructor(
    public admin: AdminService,
    private cd: ChangeDetectorRef,
  ) { }

  get control() {
    return this.group.get(this.fieldName) as UntypedFormControl;
  }

  ngOnInit() {
    this.readJson(this.control.value);
    this.control.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(value => this.readJson(value));
  }

  private readJson(value?: string) {
    if (value === this.json) return;
    this.json = value;
    try {
      this.model = value ? JSON.parse(value) : {};
    } catch (e) {
      // Keep the last valid model while the JSON is being edited
      return;
    }
    this.options.formState.config = this.model;
    this.cd.markForCheck();
  }

  modelChange(model: any) {
    this.json = JSON.stringify(model, null, 2);
    this.control.setValue(this.json);
    this.control.markAsDirty();
  }
}
