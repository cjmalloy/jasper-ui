import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostBinding,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  viewChild
} from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { defer, isObject } from 'lodash-es';

import { catchError, of, Subscription, switchMap, throwError } from 'rxjs';
import { LoadingComponent } from '../../component/loading/loading.component';
import { SelectTemplateComponent } from '../../component/select-template/select-template.component';
import { SettingsComponent } from '../../component/settings/settings.component';
import { LimitWidthDirective } from '../../directive/limit-width.directive';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';
import { scrollToFirstInvalid } from '../../util/form';
import { TAG_SUFFIX_REGEX } from '../../util/format';
import { printError } from '../../util/http';
import { access, hasPrefix, localTag, prefix } from '../../util/tag';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
  imports: [
    RouterLink,
    SettingsComponent,
    ReactiveFormsModule,
    SelectTemplateComponent,
    LoadingComponent,
    LimitWidthDirective,
    ExtFormComponent,
  ],
})
export class ExtPage implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  private admin = inject(AdminService);
  router = inject(Router);
  store = inject(Store);
  private exts = inject(ExtService);
  private fb = inject(UntypedFormBuilder);


  @HostBinding('class') css = 'full-page-form';

  readonly form = viewChild<ExtFormComponent>('form');

  template = '';
  created = false;
  submitted = false;
  invalid = false;
  overwritten = false;
  overwrite = false;
  extForm: UntypedFormGroup;
  editForm!: UntypedFormGroup;
  serverError: string[] = [];

  templates = this.admin.tmplSubmit;

  creating?: Subscription;
  editing?: Subscription;
  deleting?: Subscription;

  private overwrittenModified? = '';

  constructor() {
    const mod = this.mod;
    const fb = this.fb;

    mod.setTitle($localize`Edit Tag`);
    this.extForm = fb.group({
      tag: ['', [Validators.pattern(TAG_SUFFIX_REGEX)]],
    });
  }

  ngOnInit(): void {
    effect(() => {
      if (!this.store.view.tag) {
        this.template = '';
        this.tag.setValue('');
        this.store.view.exts = [];
      } else {
        const tag = this.store.view.localTag + this.store.account.origin;
        this.exts.get(tag).pipe(
          catchError(() => of(undefined)),
        ).subscribe(ext => this.setExt(tag, ext));
      }
    }, { injector: this.injector });
  }

  saveChanges() {
    return !this.editForm?.dirty;
  }

  setExt(tag: string, ext?: Ext) {
    tag = localTag(tag);
    this.store.view.exts = ext ? [ext] : [];
    if (ext) {
      this.editForm = extForm(this.fb, ext, this.admin, true);
      this.editForm.patchValue(ext);
      defer(() => this.form()!.setValue(ext));
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
        if (template?.config?.submit) {
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
      modifiedString: this.overwrite ? this.overwrittenModified : this.store.view.ext!.modifiedString,
    };
    const config = this.store.view.ext!.config;
    ext = {
      ...this.store.view.ext,
      ...ext,
      config: {
        ...isObject(config) ? config : {},
        ...ext.config,
      },
    };
    this.editing = this.exts.update(ext).pipe(
      catchError((res: HttpErrorResponse) => {
        delete this.editing;
        if (res.status === 400) {
          this.invalid = true;
          console.log(res.message);
          // TODO: read res.message to find which fields to delete
        }
        if (res.status === 409) {
          this.overwritten = true;
          this.exts.get(ext.tag + ext.origin).subscribe(x => this.overwrittenModified = x.modifiedString);
        }
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.editing;
      this.editForm.markAsPristine();
      if (ext.tag === 'config/home' && this.admin.getTemplate('config/home')) {
        this.router.navigate(['/home']);
      } else {
        this.router.navigate(['/tag', ext.tag]);
      }
    });
  }

  delete() {
    const ext = this.store.view.ext!;
    // TODO: Better dialogs
    if (confirm($localize`Are you sure you want to delete this tag extension?`)) {
      const deleteNotice = !isDeletorTag(ext.tag) && this.admin.getPlugin('plugin/delete')
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
