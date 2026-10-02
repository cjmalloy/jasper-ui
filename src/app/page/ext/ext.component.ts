import { HttpErrorResponse } from '@angular/common/http';
import { Component, ChangeDetectionStrategy, viewChild, effect, signal, untracked } from '@angular/core';
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
  selector: 'app-ext-page',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
  host: { 'class': 'full-page-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class ExtPage implements HasChanges {

  readonly template = signal<string>('');
  readonly submitted = signal<boolean>(false);
  readonly invalid = signal<boolean>(false);
  readonly overwritten = signal<boolean>(false);
  readonly serverError = signal<string[]>([]);
  readonly creating = signal(false);
  private creatingSubscription?: Subscription;
  readonly editing = signal(false);
  private editingSubscription?: Subscription;
  readonly deleting = signal(false);
  private deletingSubscription?: Subscription;
  readonly overwrittenModified = signal<string | undefined>('');

  readonly form = viewChild<ExtFormComponent>('form');
  created = false;
  overwrite = false;
  extForm: UntypedFormGroup;

  templates = this.admin.tmplSubmit();
  readonly editForm = signal<UntypedFormGroup | undefined>(undefined);

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
    effect(() => {
      this.store.view.tag();
      this.store.view.localTag();
      this.store.account.origin();
      untracked(() => {
        if (!this.store.view.tag()) {
          this.template.set('');
          this.tag.setValue('');
          this.store.view.exts.set([]);
        } else {
          const tag = this.store.view.localTag() + this.store.account.origin();
          this.exts.get(tag).pipe(
            catchError(() => of(undefined)),
          ).subscribe(ext => this.setExt(tag, ext));
        }
      });
    });
  }

  saveChanges() {
    return !this.editForm()?.dirty;
  }

  setExt(tag: string, ext?: Ext) {
    tag = localTag(tag);
    this.store.view.exts.set(ext ? [ext] : []);
    if (ext) {
      const editForm = extForm(this.fb, ext, this.admin, true);
      editForm.patchValue(ext);
      this.editForm.set(editForm);
      defer(() => this.form()!.setValue(ext));
    } else {
      for (const t of this.templates) {
        if (hasPrefix(tag, t.tag)) {
          this.template.set(t.tag);
          this.tag.setValue(access(tag) + tag.substring(t.tag.length + access(tag).length + 1))
          return;
        }
      }
      if (tag) {
        const template = this.admin.getTemplate(tag);
        if (template?.config?.submit) {
          this.templates.unshift(template);
          this.template.set(tag);
          this.tag.setValue('')
          return;
        }
      }
      this.template.set('');
      this.tag.setValue(tag);
    }
  }

  get tag() {
    return this.extForm.get('tag') as UntypedFormControl;
  }

  prefix(tag: string) {
    if (!this.template()) return tag;
    if (!tag) return this.template();
    if (access(this.template()) && access(tag)) tag = tag.substring(access(tag).length);
    return prefix(this.template(), tag);
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
    this.serverError.set([]);
    this.submitted.set(true);
    this.extForm.markAllAsTouched();
    if (!this.extForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const prefixed = this.prefix(this.tag.value);
    const tag = prefixed + this.store.account.origin();
    this.creating.set(true);
    this.creatingSubscription = this.exts.create({
      tag: prefixed,
      origin: this.store.account.origin(),
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
        this.creating.set(false);
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(ext => {
      this.creating.set(false);
      this.serverError.set([]);
      this.setExt(tag, ext);
      this.router.navigate(['/ext', ext.tag]);
    });
    this.creatingSubscription?.add(() => this.creating.set(false));
  }

  save() {
    this.serverError.set([]);
    this.submitted.set(true);
    this.editForm()!.markAllAsTouched();
    if (!this.editForm()!.valid) {
      scrollToFirstInvalid();
      return;
    }
    let ext = {
      ...this.editForm()!.value,
      tag: this.store.view.ext()!.tag, // Need to fetch because control is disabled
      modifiedString: this.overwrite ? this.overwrittenModified() : this.store.view.ext()!.modifiedString,
    };
    const config = this.store.view.ext()!.config;
    ext = {
      ...this.store.view.ext(),
      ...ext,
      config: {
        ...isObject(config) ? config : {},
        ...ext.config,
      },
    };
    this.editing.set(true);
    this.editingSubscription = this.exts.update(ext).pipe(
      catchError((res: HttpErrorResponse) => {
        this.editing.set(false);
        if (res.status === 400) {
          this.invalid.set(true);
          console.log(res.message);
          // TODO: read res.message to find which fields to delete
        }
        if (res.status === 409) {
          this.overwritten.set(true);
          this.exts.get(ext.tag + ext.origin).subscribe(x => this.overwrittenModified.set(x.modifiedString));
        }
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.editing.set(false);
      this.editForm()!.markAsPristine();
      if (ext.tag === 'config/home' && this.admin.home()) {
        this.router.navigate(['/home']);
      } else {
        this.router.navigate(['/tag', ext.tag]);
      }
    });
    this.editingSubscription?.add(() => this.editing.set(false));
  }

  delete() {
    const ext = this.store.view.ext()!;
    // TODO: Better dialogs
    if (confirm($localize`Are you sure you want to delete this tag extension?`)) {
      const deleteNotice = !isDeletorTag(ext.tag) && this.admin.getPlugin('plugin/delete')
        ? this.exts.create(tagDeleteNotice(ext))
        : of(null);
      this.deleting.set(true);
    this.deletingSubscription = this.exts.delete(ext.tag + ext.origin).pipe(
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          this.deleting.set(false);
          this.serverError.set(printError(err));
          return throwError(() => err);
        }),
      ).subscribe(() => {
        this.deleting.set(false);
        this.router.navigate(['/tag', ext.tag]);
      });
    this.deletingSubscription?.add(() => this.deleting.set(false));
    }
  }

  clear() {
    this.router.navigateByUrl('/ext');
  }
}
