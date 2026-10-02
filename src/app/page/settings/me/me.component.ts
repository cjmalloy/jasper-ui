import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, isDevMode, ChangeDetectionStrategy, viewChild, signal } from '@angular/core';
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
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-me-page',
  templateUrl: './me.component.html',
  styleUrls: ['./me.component.scss'],
  host: { 'class': 'full-page-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LimitWidthDirective, UserTagSelectorComponent, ExtFormComponent, LoadingComponent]
})
export class SettingsMePage implements HasChanges {

  private readonly _submitted = signal<boolean>(false);
  get submitted() { return this._submitted(); }
  set submitted(value: boolean) { this._submitted.set(value); }
  private readonly _serverError = signal<string[]>([]);
  get serverError() { return this._serverError(); }
  set serverError(value: string[]) { this._serverError.set(value); }
  private readonly _editing = signal<Subscription | undefined>(undefined);
  get editing() { return this._editing(); }
  set editing(value: Subscription | undefined) { this._editing.set(value); }

  readonly form = viewChild<ExtFormComponent>('form');
  editForm!: UntypedFormGroup;

  constructor(
    public config: ConfigService,
    public store: Store,
    private exts: ExtService,
    private accounts: AccountService,
    private admin: AdminService,
    private fb: FormBuilder,
    private location: Location,
  ) {
    const ext = cloneDeep(store.account.ext!);
    this.editForm = extForm(fb, ext, this.admin, true);
    this.editForm.patchValue(ext);
    if (ext) defer(() => this.form()!.setValue(ext));
  }

  saveChanges() {
    return !this.editForm?.dirty;
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const ext = this.store.account.ext!;
    this.editing = this.exts.update({
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
        this.editing = undefined;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.editing = undefined;
      this.editForm.markAsPristine();
      this.location.back();
    });
  }

  protected readonly isDevMode = isDevMode;
}
