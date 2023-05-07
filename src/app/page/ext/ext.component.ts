import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { Ext } from '../../model/ext';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { TAG_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { getPrefix, hasPrefix, localTag, prefix } from '../../util/tag';

@Component({
  selector: 'app-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class ExtPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  @HostBinding('class') css = 'full-page-form';

  @ViewChild('form')
  form?: ExtFormComponent;

  template = '';
  created = false;
  submitted = false;
  extForm: UntypedFormGroup;
  editForm!: UntypedFormGroup;
  serverError: string[] = [];

  templates = this.admin.tmplSubmit;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public router: Router,
    private route: ActivatedRoute,
    public store: Store,
    private account: AccountService,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Edit Tag`);
    this.extForm = fb.group({
      tag: ['', [Validators.required, Validators.pattern(TAG_REGEX)]],
    });
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      if (!this.store.view.tag) {
        this.template = '';
        this.tag.setValue('');
        runInAction(() => this.store.view.ext = undefined);
      } else {
        const tag = this.store.view.localTag + this.store.account.origin;
        this.exts.get(tag).pipe(
          catchError(() => of(undefined)),
        ).subscribe(ext => this.setExt(tag, ext));
      }
    }));
  }

  setExt(tag: string, ext?: Ext) {
    tag = localTag(tag);
    for (const t of this.templates) {
      if (tag === t.tag) {
        this.template = t.tag + '/';
        this.tag.setValue(tag.substring(t.tag.length + 1))
        return;
      }
    }
    runInAction(() => this.store.view.ext = ext);
    if (ext) {
      this.editForm = extForm(this.fb, ext, this.admin, true);
      this.editForm.patchValue(ext);
      defer(() => this.form!.setValue(ext));
    } else {
      for (const t of this.templates) {
        if (hasPrefix(tag, t.tag)) {
          this.template = t.tag + '/';
          this.tag.setValue(tag.substring(t.tag.length + 1))
          return;
        }
      }
      this.template = '';
      this.tag.setValue(tag);
    }
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get tag() {
    return this.extForm.get('tag') as UntypedFormControl;
  }

  prefix(tag: string) {
    if (!this.template) return tag;
    if (tag.startsWith('+') || tag.startsWith('_')) {
      return tag.substring(0, 1) + this.template + tag.substring(1);
    }
    return this.template + tag;
  }

  create() {
    this.serverError = [];
    this.submitted = true;
    this.extForm.markAllAsTouched();
    if (!this.extForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const prefixed = this.prefix(this.tag.value);
    const tag = prefixed + this.store.account.origin;
    this.exts.create({
      tag: prefixed,
      origin: this.store.account.origin,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        if (res.status === 409) {
          // Ignore Already exists error
          return of(null);
        }
        return throwError(() => res);
      }),
      switchMap(() => this.exts.get(tag)),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(ext => {
      this.serverError = [];
      this.setExt(tag, ext);
      this.router.navigate(['/ext', ext.tag]);
    });
  }

  save() {
    this.serverError = [];
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const ext = this.store.view.ext!;
    this.exts.update({
      ...ext,
      ...this.editForm.value,
      tag: ext.tag, // Need to fetch because control is disabled
      config: {
        ...ext.config,
        ...this.editForm.value.config,
      },
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/tag', ext.tag]);
    });
  }

  delete() {
    const ext = this.store.view.ext!;
    // TODO: Better dialogs
    if (window.confirm($localize`Are you sure you want to delete this tag extension?`)) {
      this.exts.delete(ext.tag + ext.origin).pipe(
        catchError((res: HttpErrorResponse) => {
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(() => {
        this.router.navigate(['/tag', ext.tag]);
      });
    }
  }

  clear() {
    this.router.navigateByUrl('/ext');
  }
}
