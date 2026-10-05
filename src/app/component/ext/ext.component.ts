import { FakeLinkDirective } from '../../directive/fake-link.directive';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, forwardRef, effect, input, linkedSignal, signal, viewChild, viewChildren, computed, untracked, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { isObject } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, of, startWith, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../directive/title.directive';
import { extForm, ExtFormComponent } from '../../form/ext/ext.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { equalsExt, Ext, writeExt } from '../../model/ext';
import { isDeletorTag, tagDeleteNotice } from '../../mods/delete';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { BookmarkService } from '../../service/bookmark.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { downloadTag } from '../../util/download';
import { scrollToFirstInvalid, controlState } from '../../util/form';
import { tagLink } from '../../util/format';
import { printError } from '../../util/http';
import { hasPrefix, parentTag } from '../../util/tag';
import { ConfirmActionComponent } from '../action/confirm-action/confirm-action.component';
import { RelativePipe } from '../../pipe/relative.pipe';

@Component({
  selector: 'app-ext',
  templateUrl: './ext.component.html',
  styleUrls: ['./ext.component.scss'],
  host: {
    'class': 'ext list-item',
    'tabindex': '0',
    '[class.deleted]': 'deleted()',
    '[class.editing]': 'editing()',
    '[class.upload]': "uploadedFile()",
    '[class.exists]': "existsFile()",
  },
  imports: [
    RelativePipe,
    FakeLinkDirective,
    forwardRef(() => ExtFormComponent),
    RouterLink,
    TitleDirective,
    ConfirmActionComponent,
    ReactiveFormsModule,
  ],
})
export class ExtComponent implements HasChanges {
  admin = inject(AdminService);
  store = inject(Store);
  private auth = inject(AuthzService);
  private exts = inject(ExtService);
  private editor = inject(EditorService);
  bookmarks = inject(BookmarkService);
  private fb = inject(UntypedFormBuilder);


  readonly extInput = input.required<Ext>({ alias: 'ext' });
  readonly ext = linkedSignal(() => this.extInput());
  readonly extFormComponent = viewChild<ExtFormComponent>('extForm');
  readonly useEditPage = input(false);

  readonly editForm = signal<UntypedFormGroup>(undefined as unknown as UntypedFormGroup);
  protected readonly editFormValid = controlState(() => this.editForm(), c => c.valid);
  protected readonly editFormDirty = controlState(() => this.editForm(), c => c.dirty);
  readonly submitted = linkedSignal(() => { this.ext(); return false; });
  readonly invalid = linkedSignal(() => { this.ext(); return false; });
  readonly overwritten = linkedSignal(() => { this.ext(); return false; });
  readonly overwrite = linkedSignal(() => { this.ext(); return false; });
  readonly icons = computed(() => [
    ...this.admin.getTemplateView(this.ext().tag),
    ...hasPrefix(this.ext().tag, 'user') ? [{tag: 'user', config: { view: $localize`🧑️` }}] : [],
  ]);
  readonly template = computed(() => this.admin.getTemplate(this.ext().tag));
  readonly plugin = computed(() => this.admin.getPlugin(this.ext().tag));
  readonly editing = linkedSignal(() => { this.ext(); return false; });
  readonly viewSource = linkedSignal(() => { this.ext(); return false; });
  readonly deleted = linkedSignal(() => { this.ext(); return false; });
  readonly writeAccess = computed(() => this.auth.tagWriteAccess(this.qualifiedTag()));
  readonly serverError = linkedSignal<string[]>(() => { this.ext(); return []; });

  private overwrittenModified? = '';

  constructor() {
    effect(() => {
      this.extInput();
      untracked(() => this.init());
    });
    effect(() => {
      const extForm = this.extFormComponent();
      untracked(() => extForm?.setValue(this.ext()));
    });
  }

  saveChanges() {
    return !this.editForm()?.dirty;
  }

  init() {
    if (this.ext()) {
      this.editForm.set(extForm(this.fb, this.ext(), this.admin, true));
    }
  }

  readonly uploadedFile = computed(() => {
    return this.ext().upload;
  });

  readonly existsFile = computed(() => {
    return this.ext().exists;
  });

  readonly qualifiedTag = computed(() => {
    return this.ext().tag + this.ext().origin;
  });
  readonly parent = computed(() => {
    const p = parentTag(this.ext().tag);
    if (!p) return p;
    return tagLink(p, this.ext().origin, this.store.account.origin());
  });
  readonly local = computed(() => {
    return this.ext().origin === this.store.account.origin();
  });
  readonly extLink = computed(() => {
    if (this.admin.local().find(t => hasPrefix(this.ext().tag, t.tag))) return this.ext().tag + (this.ext().origin || '@');
    return tagLink(this.ext().tag, this.ext().origin, this.store.account.origin());
  });
  readonly preview = toSignal(toObservable(computed(() => ({
    tag: this.ext().tag, origin: this.ext().origin,
  }))).pipe(switchMap(({ tag, origin }) => this.editor.getTagPreview(tag, origin).pipe(startWith(undefined)))), { initialValue: undefined });

  save() {
    this.submitted.set(true);
    this.editForm().markAllAsTouched();
    if (!this.editForm().valid) {
      scrollToFirstInvalid();
      return;
    }
    let ext = {
      ...this.editForm().value,
      tag: this.ext().tag, // Need to fetch because control is disabled
      modifiedString: this.overwrite() ? this.overwrittenModified : this.ext().modifiedString,
    };
    const config = this.ext().config;
    ext = {
      ...this.ext(),
      ...ext,
      config: {
        ...isObject(config) ? config : {},
        ...ext.config,
      },
    };
    if (this.ext().upload) {
      ext.upload = true;
      this.ext.set(ext);
      this.store.submit.setExt(this.ext());
    } else {
      this.exts.update(ext).pipe(
        switchMap(() => this.exts.get(this.qualifiedTag())),
        catchError((res: HttpErrorResponse) => {
          if (res.status === 400) {
            this.invalid.set(true);
            console.log(res.message);
            // TODO: read res.message to find which fields to delete
          }
          if (res.status === 409) {
            this.overwritten.set(true);
            this.exts.get(this.qualifiedTag()).subscribe(x => this.overwrittenModified = x.modifiedString);
          }
          this.serverError.set(printError(res));
          return throwError(() => res);
        }),
      ).subscribe(ext => {
        this.editForm().reset();
        this.ext.set(ext);
        this.init();
      });
    }
  }

  upload() {
    (this.store.submit.overwrite()
      ? this.exts.update({ ...this.ext(), origin: this.store.account.origin() })
      : this.exts.create({ ...this.ext(), origin: this.store.account.origin() })).pipe(
      catchError((err: HttpErrorResponse) => {
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
    ).subscribe(cursor => {
      this.ext.set({
        ...this.ext(),
        modifiedString: cursor,
        modified: DateTime.fromISO(cursor),
        origin: this.store.account.origin(),
      });
      this.store.submit.removeExt(this.ext());
      this.init();
    });
  }

  copy() {
    const copied: Ext = {
      ...this.ext(),
      origin: this.store.account.origin(),
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
        this.serverError.set(printError(err));
        return throwError(() => err);
      }),
      switchMap(() => this.exts.get(this.ext().tag + this.store.account.origin())),
    ).subscribe(ext => {
      this.ext.set(ext);
      this.init();
    });
  }

  delete$ = () => {
    this.serverError.set([]);
    if (this.ext().upload) {
      this.store.submit.removeExt(this.ext());
      this.deleted.set(true);
      return of(null);
    } else {
      const deleteNotice = !isDeletorTag(this.ext().tag) && this.admin.getPlugin('plugin/delete')
        ? this.exts.create(tagDeleteNotice(this.ext()))
        : of(null);
      return this.exts.delete(this.qualifiedTag()).pipe(
        tap(() => this.deleted.set(true)),
        switchMap(() => deleteNotice),
        catchError((err: HttpErrorResponse) => {
          this.serverError.set(printError(err));
          return throwError(() => err);
        }),
      );
    }
  }

  download() {
    downloadTag(writeExt(this.ext()));
  }
}
