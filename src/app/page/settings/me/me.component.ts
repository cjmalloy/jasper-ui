import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, ViewChild } from '@angular/core';
import { FormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { cloneDeep, defer } from 'lodash-es';
import { runInAction } from 'mobx';
import { catchError, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { extForm, ExtFormComponent } from '../../../form/ext/ext.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-settings-me-page',
  templateUrl: './me.component.html',
  styleUrls: ['./me.component.scss']
})
export class SettingsMePage implements HasChanges {
  @HostBinding('class') css = 'full-page-form';

  @ViewChild('form')
  form?: ExtFormComponent;

  submitted = false;
  editForm!: UntypedFormGroup;
  serverError: string[] = [];

  editing?: Subscription;

  constructor(
    public store: Store,
    private exts: ExtService,
    private accounts: AccountService,
    private admin: AdminService,
    private fb: FormBuilder,
    private router: Router,
  ) {
    const ext = cloneDeep(store.account.ext!);
    this.editForm = extForm(fb, ext, this.admin, true);
    this.editForm.patchValue(ext);
    defer(() => this.form!.setValue(ext));
    if (!admin.getTemplate('user') || !store.account.localTag) {
      let defaultPath = ['/settings/plugin'];
      if (store.account.admin) {
        defaultPath = ['/settings/setup'];
      } else if (store.settings.plugins.length) {
        defaultPath = ['/settings/ref/', store.settings.plugins[0].tag];
      }
      router.navigate(defaultPath, { replaceUrl: true });
    }
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
      tap(() => runInAction(() => this.accounts.clearCache())),
      switchMap(() => this.accounts.initExt$),
      catchError((res: HttpErrorResponse) => {
        delete this.editing;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.editing;
      this.editForm.markAsPristine();
      this.router.navigate(['/tag', this.store.account.tag]);
    });
  }

}
