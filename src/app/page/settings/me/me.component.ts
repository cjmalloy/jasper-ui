import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, viewChild, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { cloneDeep, defer } from 'lodash-es';
import { catchError, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { UserTagSelectorComponent } from '../../../component/user-tag-selector/user-tag-selector.component';
import { LimitWidthDirective } from '../../../directive/limit-width.directive';
import { extForm, ExtFormComponent } from '../../../form/ext/ext.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { ConfigService } from '../../../service/config.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid, controlState } from '../../../util/form';
import { printError } from '../../../util/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings-me-page',
  templateUrl: './me.component.html',
  styleUrls: ['./me.component.scss'],
  host: { 'class': 'full-page-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LimitWidthDirective, UserTagSelectorComponent, ExtFormComponent, LoadingComponent]
})
export class SettingsMePage implements HasChanges {

  readonly submitted = signal<boolean>(false);
  readonly serverError = signal<string[]>([]);
  readonly editing = signal(false);
  private editingSubscription?: Subscription;

  readonly form = viewChild<ExtFormComponent>('form');
  editForm!: UntypedFormGroup;
  protected readonly editFormValid = controlState(() => this.editForm, c => c.valid);

  constructor(
    public config: ConfigService,
    public store: Store,
    private exts: ExtService,
    private accounts: AccountService,
    private admin: AdminService,
    private fb: FormBuilder,
    private location: Location,
  ) {
    const ext = cloneDeep(store.account.ext()!);
    this.editForm = extForm(fb, ext, this.admin, true);
    this.editForm.patchValue(ext);
    if (ext) defer(() => this.form()!.setValue(ext));
  }

  saveChanges() {
    return !this.editForm?.dirty;
  }

  save() {
    this.serverError.set([]);
    this.submitted.set(true);
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const ext = this.store.account.ext()!;
    this.editing.set(true);
    this.editingSubscription = this.exts.update({
      ...ext,
      ...this.editForm.value,
      tag: ext.tag, // Need to fetch because control is disabled
      config: {
        ...ext.config,
        ...this.editForm.value.config,
      },
    }).pipe(
      tap(() => this.accounts.clearCache()),
      switchMap(() => this.accounts.initExt$),
      catchError((res: HttpErrorResponse) => {
        this.editing.set(false);
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.editing.set(false);
      this.editForm.markAsPristine();
      this.location.back();
    });
    this.editingSubscription?.add(() => this.editing.set(false));
  }

  protected readonly isDevMode = () => environment.dev;
}
