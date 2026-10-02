import { AsyncPipe } from '@angular/common';
import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  forwardRef,
  ChangeDetectionStrategy,
  effect,
  input,
  linkedSignal,
  signal,
  viewChild,
  viewChildren,
  computed,
  untracked
} from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isObject } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../directive/title.directive';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { equalsExt, Ext, writeExt } from '../../model/ext';
import { Plugin } from '../../model/plugin';
import { Template } from '../../model/template';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid } from '../../util/form';
import { tagLink } from '../../util/format';
import { printError } from '../../util/http';
import { hasPrefix, parentTag } from '../../util/tag';
import { ActionComponent } from '../action/action.component';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';

@Component({
  selector: 'app-ext',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
  host: {
    'class': 'ext list-item',
    'tabindex': '0',
    '[class.deleted]': 'deleted',
    '[class.upload]': 'uploadedFile',
    '[class.exists]': 'existsFile',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FakeLinkDirective,
    forwardRef(() => ExtFormComponent),
    RouterLink,
    TitleDirective,
    ConfirmActionComponent,
    ReactiveFormsModule,
    AsyncPipe,
  ],
})
export class ExtComponent implements HasChanges {
  readonly actionComponents = viewChildren<ActionComponent>('action');

  readonly extInput = input.required<Ext>({ alias: 'ext' });
  private readonly _ext = linkedSignal(() => this.extInput());
  get ext() { return this._ext(); }
  set ext(value: Ext) { this._ext.set(value); }
  readonly extFormComponent = viewChild<ExtFormComponent>('extForm');
  readonly useEditPage = input(false);

  private readonly _editForm = signal<UntypedFormGroup>(undefined as unknown as UntypedFormGroup);
  private readonly _submitted = signal(false);
  private readonly _invalid = signal(false);
  private readonly _overwritten = signal(false);
  private readonly _overwrite = signal(true);
  private readonly _icons = signal<Template[]>([]);
  private readonly _template = signal<Template | undefined>(undefined);
  private readonly _plugin = signal<Plugin | undefined>(undefined);
  private readonly _editing = signal(false);
  private readonly _viewSource = signal(false);
  private readonly _deleted = signal(false);
  private readonly _writeAccess = signal(false);
  private readonly _serverError = signal<string[]>([]);
  get editForm() { return this._editForm(); }
  set editForm(value: UntypedFormGroup) { this._editForm.set(value); }
  get submitted() { return this._submitted(); }
  set submitted(value: boolean) { this._submitted.set(value); }
  get overwrite() { return this._overwrite(); }
  set overwrite(value: boolean) { this._overwrite.set(value); }
  get icons() { return this._icons(); }
  set icons(value: Template[]) { this._icons.set(value); }
  get template() { return this._template(); }
  set template(value: Template | undefined) { this._template.set(value); }
  get plugin() { return this._plugin(); }
  set plugin(value: Plugin | undefined) { this._plugin.set(value); }
  get editing() { return this._editing(); }
  set editing(value: boolean) { this._editing.set(value); }
  get viewSource() { return this._viewSource(); }
  set viewSource(value: boolean) { this._viewSource.set(value); }
  get deleted() { return this._deleted(); }
  set deleted(value: boolean) { this._deleted.set(value); }
  get invalid() { return this._invalid(); }
  set invalid(value: boolean) { this._invalid.set(value); }
  get overwritten() { return this._overwritten(); }
  set overwritten(value: boolean) { this._overwritten.set(value); }
  get writeAccess() { return this._writeAccess(); }
  set writeAccess(value: boolean) { this._writeAccess.set(value); }
  get serverError() { return this._serverError(); }
  set serverError(value: string[]) { this._serverError.set(value); }

  private overwrittenModified? = '';

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private exts: ExtService,
    private editor: EditorService,
    public bookmarks: BookmarkService,
    private fb: UntypedFormBuilder,
  ) {
    effect(() => {
      this.extInput();
      untracked(() => this.init());
    });
    effect(() => {
      this.extFormComponent()?.setValue(this.ext);
    });
  }

  saveChanges() {
    return !this.editForm?.dirty;
  }

  init() {
    this.submitted = false;
    this.invalid = false;
    this.overwrite = false;
    this.overwritten = false;
    this.template = this.admin.getTemplate(this.ext.tag);
    this.plugin = this.admin.getPlugin(this.ext.tag);
    this.editing = false;
    this.viewSource = false;
    this.deleted = false;
    this.writeAccess = false;
    this.serverError = [];
    this.actionComponents()?.forEach(c => c.reset());
    if (this.ext) {
      this.icons = this.admin.getTemplateView(this.ext.tag);
      if (hasPrefix(this.ext.tag, 'user')) {
        this.icons = [...this.icons, {tag: 'user', config: { view: $localize`🧑️` }}];
      }
      this.editForm = extForm(this.fb, this.ext, this.admin, true);
      this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag());
    } else {
      this.icons = [];
      this.writeAccess = false;
    }
  }

  get uploadedFile() {
    return this.ext.upload;
  }

  get existsFile() {
    return this.ext.exists;
  }

  readonly qualifiedTag = computed(() => {
    return this.ext.tag + this.ext.origin;
  });
  readonly parent = computed(() => {
    const p = parentTag(this.ext.tag);
    if (!p) return p;
    return tagLink(p, this.ext.origin, this.store.account.origin);
  });
  readonly local = computed(() => {
    return this.ext.origin === this.store.account.origin;
  });
  readonly extLink = computed(() => {
    if (this.admin.local.find(t => hasPrefix(this.ext.tag, t.tag))) return this.ext.tag + (this.ext.origin || '@');
    return tagLink(this.ext.tag, this.ext.origin, this.store.account.origin);
  });
  readonly preview = computed(() => {
    return this.editor.getTagPreview(this.ext.tag, this.ext.origin);
  });

  save() {
    this.submitted = true;
    this.editForm.markAllAsTouched();
    if (!this.editForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    let ext = {
      ...this.editForm.value,
      tag: this.ext.tag, // Need to fetch because control is disabled
      modifiedString: this.overwrite ? this.overwrittenModified : this.ext.modifiedString,
    };
    const config = this.ext.config;
    ext = {
      ...this.ext,
      ...ext,
      config: {
        ...isObject(config) ? config : {},
        ...ext.config,
      },
    };
    if (this.ext.upload) {
      ext.upload = true;
      this.ext = ext;
      this.store.submit.setExt(this.ext);
    } else {
      this.exts.update(ext).pipe(
        switchMap(() => this.exts.get(this.qualifiedTag())),
        catchError((res: HttpErrorResponse) => {
          if (res.status === 400) {
            this.invalid = true;
            console.log(res.message);
            // TODO: read res.message to find which fields to delete
          }
          if (res.status === 409) {
            this.overwritten = true;
            this.exts.get(this.qualifiedTag()).subscribe(x => this.overwrittenModified = x.modifiedString);
          }
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(ext => {
        this.editForm.reset();
        this.ext = ext;
        this.init();
      });
    }
  }

  upload() {
    (this.store.submit.overwrite
      ? this.exts.update({ ...this.ext, origin: this.store.account.origin })
      : this.exts.create({ ...this.ext, origin: this.store.account.origin })).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError = printError(err);
        return throwError(() => err);
      }),
    ).subscribe(cursor => {
      this.ext = {
        ...this.ext,
        modifiedString: cursor,
        modified: DateTime.fromISO(cursor),
        origin: this.store.account.origin,
      };
      this.store.submit.removeExt(this.ext);
      this.init();
    });
  }

  copy() {
    const copied: Ext = {
      ...this.ext,
      origin: this.store.account.origin,
    };
    this.exts.create(copied).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 409) {
          return this.exts.get(this.qualifiedTag()).pipe(
            switchMap(ext => {
              if (equalsExt(ext, copied) || confirm('An old version already exists. Overwrite it?')) {
                // TODO: Show diff and merge or split
                return this.exts.update(copied);
              } else {
                return throwError(() => 'Cancelled')
              }
            })
          );
        }
        this.serverError = printError(err);
        return throwError(() => err);
      }),
      switchMap(() => this.exts.get(this.ext.tag + this.store.account.origin)),
    ).subscribe(ext => {
      this.ext = ext;
      this.init();
    });
  }

  delete$ = () => {
    this.serverError = [];
    if (this.ext.upload) {
      this.store.submit.removeExt(this.ext);
      this.deleted = true;
      return of(null);
    } else {
      const deleteNotice = !isDeletorTag(this.ext.tag) && this.admin.getPlugin('plugin/delete')
        ? this.exts.create(tagDeleteNotice(this.ext))
        : of(null);
      return this.exts.delete(this.qualifiedTag()).pipe(
        tap(() => this.deleted = true),
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          this.serverError = printError(err);
          return throwError(() => err);
        }),
      );
    }
  }

  download() {
    downloadTag(writeExt(this.ext));
  }
}
