import { HttpErrorResponse } from '@angular/common/http';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { Component, ElementRef, forwardRef, viewChild, effect, computed, signal, inject, Injector, untracked, afterNextRender } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup
} from '@angular/forms';
import { Router } from '@angular/router';
import { defer, isEqual, some, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { catchError, firstValueFrom, forkJoin, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { NavComponent } from '../../../component/nav/nav.component';
import { SelectPluginComponent } from '../../../component/select-plugin/select-plugin.component';
import { FillWidthDirective } from '../../../directive/fill-width.directive';
import { LimitWidthDirective } from '../../../directive/limit-width.directive';
import { ResizeHandleDirective } from '../../../directive/resize-handle.directive';
import { EditorComponent } from '../../../form/editor/editor.component';
import { LinksFormComponent } from '../../../form/links/links.component';
import { PluginsFormComponent, writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Ref } from '../../../model/ref';
import { wikiTitleFormat, wikiUriFormat } from '../../../mods/org/wiki';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { readFileAsString } from '../../../util/async';
import { scrollToFirstInvalid, controlValue, controlState } from '../../../util/form';
import { printError } from '../../../util/http';
import { getVisibilityTags, hasPrefix, hasTag } from '../../../util/tag';

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
  host: { 'class': 'full-page-form' },
  imports: [
    FakeLinkDirective,
    forwardRef(() => EditorComponent),
    ReactiveFormsModule,
    LimitWidthDirective,
    NavComponent,
    LoadingComponent,
    SelectPluginComponent,
    PluginsFormComponent,
    MonacoEditorModule,
    ResizeHandleDirective,
    FillWidthDirective,
    TagsFormComponent,
    forwardRef(() => RefFormComponent),
  ],
})
export class SubmitTextPage implements HasChanges {
  config = inject(ConfigService);
  private mod = inject(ModService);
  admin = inject(AdminService);
  private router = inject(Router);
  store = inject(Store);
  bookmarks = inject(BookmarkService);
  private editor = inject(EditorService);
  private refs = inject(RefService);
  private exts = inject(ExtService);
  private ts = inject(TaggingService);
  private fb = inject(UntypedFormBuilder);



  private readonly injector = inject(Injector);
  private generatedUrl = 'comment:' + uuid();

  readonly submitted = signal<boolean>(false);
  textForm: UntypedFormGroup;
  protected readonly textFormValid = controlState(() => this.textForm, c => c.valid);
  protected readonly textFormPristine = controlState(() => this.textForm, c => c.pristine);
  readonly advanced = signal<boolean>(false);
  readonly serverError = signal<string[]>([]);

  readonly limitWidth = signal<HTMLElement | undefined>(undefined);

  readonly fill = viewChild<ElementRef>('fill');
  private _advancedFill?: ElementRef;

  readonly editorComponent = viewChild<EditorComponent>('ed');

  readonly tagsFormComponent = viewChild.required<TagsFormComponent>('tagsFormComponent');
  readonly plugins = viewChild.required<PluginsFormComponent>('plugins');

  readonly submitting = signal(false);
  private submittingSubscription?: Subscription;
  readonly saving = signal(false);
  private savingSubscription?: Subscription;
  addAnother = false;
  readonly defaults = signal<{ url: string, ref: Partial<Ref> } | undefined>(undefined);
  readonly loadingDefaults = signal<Ext[]>([]);
  readonly completedUploads = signal<Ref[]>([]);
  private oldSubmit: string[] = [];
  private savedRef?: Ref;
  private cursor?: string;
  private readonly tagsValue = controlValue<string[]>(() => this.tags);

  constructor() {
    const mod = this.mod;
    const admin = this.admin;
    const store = this.store;
    const fb = this.fb;

    mod.setTitle($localize`Submit: Text Post`);
    this.textForm = refForm(fb);
    this.ensureUrl();
    store.submit.wikiPrefix.set(admin.getWikiPrefix());
    effect(() => {
      const fill = this.fill();
      defer(() => this.limitWidth.set(this._advancedFill?.nativeElement || fill?.nativeElement));
    });
    effect(() => {
      const value = this.advancedForm();
      untracked(() => this.setAdvancedForm(value));
    });
  }

  addCompletedUpload(ref: Ref) {
    this.completedUploads.update(uploads => [...uploads, ref]);
  }

  async saveChanges() {
    if (this.admin.editing() && this.textForm.dirty) {
      return firstValueFrom(this.refs.saveEdit(this.writeRef(), this.cursor)
        .pipe(map(() => true), catchError(() => of(false))));
    }
    return !this.textForm?.dirty;
  }

  private readonly initializeView = afterNextRender(() => {
    if (this.admin.editing() && this.store.submit.url()) {
      this.refs.getEditing(this.store.submit.url()).subscribe(draft => {
        if (!draft) return;
        this.cursor = draft.modifiedString;
        const edit = draft.plugins?.['plugin/editing'] || {};
        if (edit.comment) this.comment.setValue(edit.comment);
        if (edit.title) this.title.setValue(edit.title);
      });
    }
    const allTags = [...this.store.submit.tags(), ...(this.store.account.localTag() ? [this.store.account.localTag()] : [])];
    this.exts.getCachedExts(allTags).pipe(
      map(xs => xs.filter(x => x.config?.defaults) as Ext[]),
      switchMap(xs => {
        this.loadingDefaults.set(xs);
        return this.refs.getDefaults(...xs.map(x => x.tag))
      }),
    ).subscribe(d => {
      this.loadingDefaults.set([]);
      this.defaults.set(d);
      if (d) {
        this.oldSubmit = uniq([...allTags, ...Object.keys(d.ref.plugins || {})]);
        this.addTag(...this.oldSubmit);
        this.plugins().setValue(d.ref.plugins);
        this.textForm.patchValue({
          ...d.ref,
          tags: this.oldSubmit,
        });
      }
      if (this.store.account.localTag()) this.addTag(this.store.account.localTag());
      effect(() => {
        this.store.submit.url();
        this.store.submit.wiki();
        this.store.submit.title();
        this.store.submit.tags();
        this.store.account.localTag();
        this.store.submit.pluginUpload();
        this.store.submit.plugin();
        this.store.submit.sources();
        untracked(() => {
          const url = this.ensureUrl();
          if (!this.admin.isWikiExternal() && this.store.submit.wiki()) {
            this.mod.setTitle($localize`Submit: Wiki`);
            this.title.setValue(wikiTitleFormat(url, this.admin.getWikiPrefix()));
            this.title.disable();
          } else if (this.store.submit.title()) {
            this.title.setValue(this.store.submit.title());
          }
          const tags = [...this.store.submit.tags(), ...(this.store.account.localTag() ? [this.store.account.localTag()] : [])];
          const added = without(tags, ...this.oldSubmit);
          const removed = without(this.oldSubmit, ...tags);
          if (added.length || removed.length) {
            this.oldSubmit = uniq([...without(this.oldSubmit, ...removed), ...added]);
            this.tagsFormComponent()!.setTags(this.oldSubmit);
          }
          if (this.store.submit.pluginUpload()) {
            this.addTag(this.store.submit.plugin());
            this.plugins().setValue({
              ...this.textForm.value.plugins || {},
              [this.store.submit.plugin()]: { url: this.store.submit.pluginUpload() },
            });
            if (this.store.submit.plugin() === 'plugin/image' || this.store.submit.plugin() === 'plugin/video') {
              this.addTag('plugin/thumbnail');
            }
          }
          for (const s of this.store.submit.sources()) {
            this.addSource(s)
          }
        });
      }, { injector: this.injector });
      if (this.store.submit.embedFiles().length) {
        const files = [...this.store.submit.embedFiles()];
        defer(() => {
          const editorComponent = this.editorComponent();
          if (this.customEditor()) {
            this.store.submit.setEmbedFiles();
            forkJoin(files.map(f => readFileAsString(f))).subscribe(texts => {
              this.comment.setValue(texts.join('\n'));
              this.comment.markAsDirty();
            });
          } else if (editorComponent instanceof EditorComponent) {
            this.store.submit.setEmbedFiles();
            editorComponent.upload(files as any);
          }
        });
      }
    });
  });

  readonly randomURL = computed(() => {
    return !this.store.submit.url() && (this.admin.isWikiExternal() || !this.store.submit.wiki()) ;
  });

  saveForLater(leave = false) {
    const savedValue = JSON.stringify(this.textForm.value);
    this.saving.set(true);
    this.savingSubscription = this.refs.saveEdit(this.writeRef(), this.cursor)
      .pipe(catchError(err => {
        this.saving.set(false);
        return throwError(() => err);
      }))
      .subscribe(cursor => {
        this.saving.set(false);
        this.cursor = cursor;
        if (JSON.stringify(this.textForm.value) === savedValue) this.textForm.markAsPristine();
        if (leave) this.router.navigate(['/inbox/ref', 'plugin/editing']);
      });
    this.savingSubscription?.add(() => this.saving.set(false));
  }

  showAdvanced() {
    const tags = uniq(this.textForm.value.tags);
    const published = this.textForm.value.published ? DateTime.fromISO(this.textForm.value.published) : DateTime.now();
    this.savedRef = {
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin(),
      published,
      tags,
      plugins: writePlugins(this.textForm.value.tags, this.textForm.value.plugins),
    };
    this.advanced.set(true);
  }

  readonly advancedForm = viewChild<RefFormComponent>('advancedForm');

  private setAdvancedForm(value: RefFormComponent | undefined) {
    if (this.savedRef && value) {
      value.setRef(this.savedRef);
      delete this.savedRef;
    }
    this._advancedFill = value?.fill();
    defer(() => this.limitWidth.set(value?.fill()?.nativeElement || this.fill()?.nativeElement));
  }

  get url() {
    return this.textForm.get('url') as UntypedFormControl;
  }

  get title() {
    return this.textForm.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.textForm.get('comment') as UntypedFormControl;
  }

  get sources() {
    return this.textForm.get('sources') as UntypedFormArray;
  }

  get tags() {
    return this.textForm.get('tags') as UntypedFormArray;
  }

  readonly codeLang = computed(() => {
    for (const t of this.tagsValue() || []) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  });

  readonly codeOptions = computed(() => ({
    language: this.codeLang(),
    theme: this.store.darkTheme() ? 'vs-dark' : 'vs',
    automaticLayout: true,
  }), { equal: isEqual });

  readonly customEditor = computed(() => {
    const tags = this.tagsValue();
    if (!tags) return false;
    return some(this.admin.editor(), t => hasTag(t.tag, tags));
  });

  setTags(value: string[]) {
    const tagsFormComponent = this.tagsFormComponent();
    if (!tagsFormComponent?.tags()) {
      defer(() => this.setTags(value));
      return;
    }
    tagsFormComponent.setTags(value);
  }

  validate(input: HTMLInputElement) {
    if (this.title.touched) {
      if (this.title.errors?.['required']) {
        input.setCustomValidity($localize`Title must not be blank.`);
        input.reportValidity();
      }
    }
  }

  addTag(...values: string[]) {
    const tagsFormComponent = this.tagsFormComponent();
    if (!tagsFormComponent?.tags()) {
      defer(() => this.addTag(...values));
      return;
    }
    tagsFormComponent.addTag(...values);
    this.submitted.set(false);
  }

  private top() {
    return this.sources.value[1] || this.sources.value[0] || this.ensureUrl();
  }

  addSource(value = '') {
    while (this.sources.value.length < 2) {
      this.sources.push(this.fb.control(this.top(), LinksFormComponent.validators));
    }
    this.sources.push(this.fb.control(value, LinksFormComponent.validators));
    this.submitted.set(false);
  }

  private ensureUrl() {
    const routeUrl = this.store.submit.url();
    const currentUrl = this.url.value;
    const wiki = this.store.submit.wiki();
    const wikiPrefix = this.admin.getWikiPrefix();
    const useRouteUrl = !!routeUrl && (!wiki || routeUrl !== wikiPrefix);
    let url = useRouteUrl ? routeUrl : currentUrl || this.generatedUrl;
    if (!this.admin.isWikiExternal() && wiki) {
      url = wikiUriFormat(url, wikiPrefix);
    }
    if (this.url.value !== url) this.url.setValue(url);
    this.url.disable();
    return url;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.textForm);
  }

  writeRef(publish = false) {
    const url = this.ensureUrl();
    return <Ref> {
      ...this.textForm.value,
      url, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin(),
      published: this.textForm.value.published ? DateTime.fromISO(this.textForm.value.published) : publish ? DateTime.now() : undefined,
      tags: uniq(this.textForm.value.tags),
      plugins: writePlugins(this.textForm.value.tags, this.textForm.value.plugins),
    };
  }

  submit() {
    if (this.saving()) {
      this.savingSubscription?.add(() => this.submit());
      return;
    }
    this.serverError.set([]);
    this.submitted.set(true);
    this.textForm.markAllAsTouched();
    this.syncEditor();
    if (!this.textForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const ref = this.writeRef(true);
    const tags = ref.tags;
    const published = ref.published;
    this.submitting.set(true);
    this.submittingSubscription = (this.cursor ? this.refs.update({ ...ref, modifiedString: this.cursor }) : this.refs.create(ref)).pipe(
      tap(() => {
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.ts.createResponse('plugin/user/vote/up', this.url.value).subscribe();
        }
      }),
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(tags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.completedUploads()
          .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
        if (!taggingOps.length) return of(res);
        return forkJoin(taggingOps).pipe(map(() => res));
      }),
      catchError((res: HttpErrorResponse) => {
        this.submitting.set(false);
        this.serverError.set(printError(res));
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitting.set(false);
      this.textForm.markAsPristine();
      this.completedUploads.set([]);

      if (this.addAnother) {
        this.url.enable();
        this.url.setValue('comment:' + uuid());
        this.url.disable();
      } else if (hasTag('plugin/thread', ref)) {
        this.router.navigate(['/ref', this.url.value, 'thread'], { queryParams: { published }, replaceUrl: true });
      } else {
        this.router.navigate(['/ref', this.url.value], { queryParams: { published }, replaceUrl: true});
      }
    });
    this.submittingSubscription?.add(() => this.submitting.set(false));
  }
}
