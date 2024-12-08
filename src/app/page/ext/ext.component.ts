import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, isObject } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { TAG_SUFFIX_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { access, hasPrefix, localTag, prefix } from '../../util/tag';

@Component({
  standalone: false,
  selector: 'app-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
})
export class ExtPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];
  @HostBinding('class') css = 'full-page-form';

  @ViewChild('form')
  form?: ExtFormComponent;

  template = '';
  created = false;
  submitted = false;
  invalid = false;
  overwrite = true;
  force = false;
  extForm: UntypedFormGroup;
  editForm!: UntypedFormGroup;
  serverError: string[] = [];

  templates = this.admin.tmplSubmit;

  creating?: Subscription;
  editing?: Subscription;
  deleting?: Subscription;

  constructor(
    private mod: ModService,
    private admin: AdminService,
    public router: Router,
    public store: Store,
    private exts: ExtService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Edit Tag`);
    this.extForm = fb.group({
      tag: ['', [Validators.pattern(TAG_SUFFIX_REGEX)]],
    });
  }

  saveChanges() {
    return !this.editForm?.dirty;
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      if (!this.store.view.tag) {
        this.template = '';
        this.tag.setValue('');
        runInAction(() => this.store.view.exts = []);
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
    runInAction(() => this.store.view.exts = ext ? [ext] : []);
    if (ext) {
      this.editForm = extForm(this.fb, ext, this.admin, true);
      this.editForm.patchValue(ext);
      defer(() => this.form!.setValue(ext));
    } else {
      for (const t of this.templates) {
        if (hasPrefix(tag, t.tag)) {
          this.template = t.tag;
          this.tag.setValue(access(tag) + tag.substring(t.tag.length + access(tag).length + 1))
          return;
        }
      }
      if (tag) {
        const template = this.admin.getTemplate(tag);
        if (template) {
          this.templates.unshift(template);
          this.template = tag;
          this.tag.setValue('')
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
    if (!tag) return this.template;
    if (access(this.template) && access(tag)) tag = tag.substring(access(tag).length);
    return prefix(this.template, tag);
  }

  validate(input: HTMLInputElement) {
    if (this.tag.touched) {
      if (this.tag.errors?.['pattern']) {
        input.setCustomValidity($localize`
          Tags must be lower case letters, numbers, periods and forward slashes.
          Must not start with a forward slash or period.
          Must not or contain two forward slashes or periods in a row.
          Protected tags start with a plus sign.
          Private tags start with an underscore.
          (i.e. "science", "my/tag", or "_my/private/tag")`);
        input.reportValidity();
      }
    }
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
    this.creating = this.exts.create({
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
        delete this.creating;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(ext => {
      delete this.creating;
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
    let ext = {
      ...this.editForm.value,
      tag: this.store.view.ext!.tag, // Need to fetch because control is disabled
      modifiedString: this.store.view.ext!.modifiedString,
    };
    if (!this.invalid || !this.overwrite) {
      const config = this.store.view.ext!.config;
      ext = {
        ...this.store.view.ext,
        ...ext,
        config: {
          ...isObject(config) ? config : {},
          ...ext.config,
        },
      }
    }
    this.editing = this.exts.update(ext, this.force).pipe(
      catchError((res: HttpErrorResponse) => {
        delete this.editing;
        if (res.status === 400) {
          if (this.invalid) {
            this.force = true;
          } else {
            this.invalid = true;
          }
        }
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.editing;
      this.editForm.markAsPristine();
      if (ext.tag === 'home' && this.admin.getTemplate('home')) {
        this.router.navigate(['/home']);
      } else {
        this.router.navigate(['/tag', ext.tag]);
      }
    });
  }

  delete() {
    const ext = this.store.view.ext!;
    // TODO: Better dialogs
    if (window.confirm($localize`Are you sure you want to delete this tag extension?`)) {
      const deleteNotice = !ext.tag.endsWith('/deleted') && this.admin.getPlugin('plugin/delete')
        ? this.exts.create(tagDeleteNotice(ext))
        : of(null);
      this.deleting = this.exts.delete(ext.tag + ext.origin).pipe(
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          delete this.deleting;
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      ).subscribe(() => {
        delete this.deleting;
        this.router.navigate(['/tag', ext.tag]);
      });
    }
  }

  clear() {
    this.router.navigateByUrl('/ext');
  }
}
