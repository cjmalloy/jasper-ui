import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  HostBinding,
  Input,
  OnChanges,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { isObject } from 'lodash-es';
import { DateTime } from 'luxon';
import { toJS } from 'mobx';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
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
import { memo, MemoCache } from '../../util/memo';
import { hasPrefix, parentTag } from '../../util/tag';
import { ActionComponent } from '../action/action.component';

@Component({
  standalone: false,
  selector: 'app-ext',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
  host: {'class': 'ext list-item'}
})
export class ExtComponent implements OnChanges, HasChanges {
  @HostBinding('attr.tabindex') tabIndex = 0;

  @ViewChildren('action')
  actionComponents?: QueryList<ActionComponent>;

  @Input()
  ext!: Ext;
  @Input()
  useEditPage = false;

  editForm!: UntypedFormGroup;
  submitted = false;
  invalid = false;
  overwritten = false;
  overwrite = true;
  icons: Template[] = [];
  template?: Template;
  plugin?: Plugin;
  editing = false;
  viewSource = false;
  @HostBinding('class.deleted')
  deleted = false;
  writeAccess = false;
  serverError: string[] = [];

  private overwrittenModified? = '';

  constructor(
    public admin: AdminService,
    public store: Store,
    private auth: AuthzService,
    private exts: ExtService,
    private editor: EditorService,
    public bookmarks: BookmarkService,
    private fb: UntypedFormBuilder,
  ) { }

  saveChanges() {
    return !this.editForm?.dirty;
  }

  init() {
    MemoCache.clear(this);
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
    this.actionComponents?.forEach(c => c.reset());
    if (this.ext) {
      this.icons = this.admin.getTemplateView(this.ext.tag);
      if (hasPrefix(this.ext.tag, 'user')) {
        this.icons.push({tag: 'user', config: { view: $localize`🧑️` }});
      }
      this.editForm = extForm(this.fb, this.ext, this.admin, true);
      this.writeAccess = this.auth.tagWriteAccess(this.qualifiedTag);
    } else {
      this.icons = [];
      this.writeAccess = false;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ext) {
      this.init();
    }
  }

  @HostBinding('class.upload')
  get uploadedFile() {
    return this.ext.upload;
  }

  @HostBinding('class.exists')
  get existsFile() {
    return this.ext.exists;
  }

  @ViewChild(ExtFormComponent)
  set extForm(value: ExtFormComponent) {
    value?.setValue(toJS(this.ext));
  }

  @memo
  get qualifiedTag() {
    return this.ext.tag + this.ext.origin;
  }

  @memo
  get parent() {
    const p = parentTag(this.ext.tag);
    if (!p) return p;
    return tagLink(p, this.ext.origin, this.store.account.origin);
  }

  @memo
  get local() {
    return this.ext.origin === this.store.account.origin;
  }

  @memo
  get extLink() {
    if (this.admin.local.find(t => hasPrefix(this.ext.tag, t.tag))) return this.ext.tag + (this.ext.origin || '@');
    return tagLink(this.ext.tag, this.ext.origin, this.store.account.origin);
  }

  @memo
  get preview() {
    return this.editor.getTagPreview(this.ext.tag, this.ext.origin);
  }

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
    if (this.ext.upload || !this.invalid || !this.overwrite) {
      const config = this.ext.config;
      ext = {
        ...this.ext,
        ...ext,
        config: {
          ...isObject(config) ? config : {},
          ...ext.config,
        },
      }
    }
    if (this.ext.upload) {
      ext.upload = true;
      this.ext = ext;
      this.store.submit.setExt(this.ext);
    } else {
      this.exts.update(ext).pipe(
        switchMap(() => this.exts.get(this.qualifiedTag)),
        catchError((res: HttpErrorResponse) => {
          if (res.status === 400) {
            this.invalid = true;
            console.log(res.message);
            // TODO: read res.message to find which fields to delete
          }
          if (res.status === 409) {
            this.overwritten = true;
            this.exts.get(this.qualifiedTag).subscribe(x => this.overwrittenModified = x.modifiedString);
          }
          this.serverError = printError(res);
          return throwError(() => res);
        }),
      ).subscribe(ext => {
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
      this.ext.modifiedString = cursor;
      this.ext.modified = DateTime.fromISO(cursor);
      this.ext.origin = this.store.account.origin;
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
          return this.exts.get(this.qualifiedTag).pipe(
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
      return this.exts.delete(this.qualifiedTag).pipe(
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
