import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import {
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup
} from '@angular/forms';
import { Router } from '@angular/router';
import { defer, some, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
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
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';
import { memo, MemoCache } from '../../../util/memo';
import { getVisibilityTags, hasPrefix, hasTag } from '../../../util/tag';

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
  host: { 'class': 'full-page-form' },
  imports: [
    EditorComponent,
    MobxAngularModule,
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
    RefFormComponent,
  ],
})
export class SubmitTextPage implements AfterViewInit, OnChanges, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  submitted = false;
  textForm: UntypedFormGroup;
  advanced = false;
  serverError: string[] = [];

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild('ed')
  editorComponent?: EditorComponent;

  @ViewChild('tagsFormComponent')
  tagsFormComponent!: TagsFormComponent;
  @ViewChild('plugins')
  plugins!: PluginsFormComponent;

  submitting?: Subscription;
  saving?: Subscription;
  addAnother = false;
  defaults?: { url: string, ref: Partial<Ref> };
  loadingDefaults: Ext[] = [];
  completedUploads: Ref[] = [];
  private oldSubmit: string[] = [];
  private savedRef?: Ref;
  private cursor?: string;

  constructor(
    public config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Text Post`);
    this.textForm = refForm(fb);
    runInAction(() => store.submit.wikiPrefix = admin.getWikiPrefix());
  }

  async saveChanges() {
    if (this.admin.editing && this.textForm.dirty) {
      return firstValueFrom(this.refs.saveEdit(this.writeRef(), this.cursor)
        .pipe(map(() => true), catchError(() => of(false))));
    }
    return !this.textForm?.dirty;
  }

  saveForLater(leave = false) {
    this.saving = this.refs.saveEdit(this.writeRef(), this.cursor)
      .pipe(catchError(err => {
        delete this.saving;
        return throwError(() => err);
      }))
      .subscribe(cursor => {
        delete this.saving;
        this.cursor = cursor;
        this.textForm.markAsPristine();
        if (leave) this.router.navigate(['/tag', this.store.account.tag], { queryParams: { filter: 'query/plugin/editing' }});
      });
  }

  ngAfterViewInit() {
    const allTags = [...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
    this.exts.getCachedExts(allTags).pipe(
      map(xs => xs.filter(x => x.config?.defaults) as Ext[]),
      switchMap(xs => {
        this.loadingDefaults = xs;
        return this.refs.getDefaults(...xs.map(x => x.tag))
      }),
    ).subscribe(d => {
      this.loadingDefaults = [];
      this.defaults = d;
      if (d) {
        this.oldSubmit = uniq([...allTags, ...Object.keys(d.ref.plugins || {})]);
        this.addTag(...this.oldSubmit);
        this.plugins.setValue(d.ref.plugins);
        this.textForm.patchValue({
          ...d.ref,
          tags: this.oldSubmit,
        });
      }
      if (this.store.account.localTag) this.addTag(this.store.account.localTag);
      this.disposers.push(autorun(() => {
        MemoCache.clear(this);
        let url = this.store.submit.url || 'comment:' + uuid();
        if (!this.admin.isWikiExternal() && this.store.submit.wiki) {
          url = wikiUriFormat(url, this.admin.getWikiPrefix());
          this.mod.setTitle($localize`Submit: Wiki`);
          this.title.setValue(wikiTitleFormat(url, this.admin.getWikiPrefix()));
          this.title.disable();
        } else if (this.store.submit.title) {
          this.title.setValue(this.store.submit.title);
        }
        this.url.setValue(url);
        this.url.disable();
        const tags = [...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
        const added = without(tags, ...this.oldSubmit);
        const removed = without(this.oldSubmit, ...tags);
        if (added.length || removed.length) {
          this.oldSubmit = uniq([...without(this.oldSubmit, ...removed), ...added]);
          this.tagsFormComponent!.setTags(this.oldSubmit);
        }
        if (this.store.submit.pluginUpload) {
          this.addTag(this.store.submit.plugin);
          this.plugins.setValue({
            ...this.textForm.value.plugins || {},
            [this.store.submit.plugin]: { url: this.store.submit.pluginUpload },
          });
          if (this.store.submit.plugin === 'plugin/image' || this.store.submit.plugin === 'plugin/video') {
            this.addTag('plugin/thumbnail');
          }
        }
        for (const s of this.store.submit.sources) {
          this.addSource(s)
        }
      }));
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    MemoCache.clear(this);
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get randomURL() {
    return !this.store.submit.url && (this.admin.isWikiExternal() || !this.store.submit.wiki) ;
  }

  showAdvanced() {
    const tags = uniq(this.textForm.value.tags);
    const published = this.textForm.value.published ? DateTime.fromISO(this.textForm.value.published) : DateTime.now();
    this.savedRef = {
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin,
      published,
      tags,
      plugins: writePlugins(this.textForm.value.tags, this.textForm.value.plugins),
    };
    this.advanced = true;
  }

  @ViewChild('advancedForm')
  set advancedForm(value: RefFormComponent | undefined) {
    if (this.savedRef && value) {
      value.setRef(this.savedRef);
      delete this.savedRef;
    }
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

  @memo
  get codeLang() {
    for (const t of this.tags.value) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  }

  @memo
  get codeOptions() {
    return {
      language: this.codeLang,
      theme: this.store.darkTheme ? 'vs-dark' : 'vs',
      automaticLayout: true,
    };
  }

  @memo
  get customEditor() {
    if (!this.tags?.value) return false;
    return some(this.admin.editor, t => hasTag(t.tag, this.tags!.value));
  }

  setTags(value: string[]) {
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.setTags(value));
      return;
    }
    this.tagsFormComponent.setTags(value);
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
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.addTag(...values));
      return;
    }
    this.tagsFormComponent.addTag(...values);
    this.submitted = false;
    MemoCache.clear(this);
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, LinksFormComponent.validators));
    this.submitted = false;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.textForm);
  }

  writeRef(publish = false) {
    return <Ref> {
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin,
      published: this.textForm.value.published ? DateTime.fromISO(this.textForm.value.published) : publish ? DateTime.now() : undefined,
      tags: uniq(this.textForm.value.tags),
      plugins: writePlugins(this.textForm.value.tags, this.textForm.value.plugins),
    };
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.textForm.markAllAsTouched();
    this.syncEditor();
    if (!this.textForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const ref = this.writeRef(true);
    const tags = ref.tags;
    const published = ref.published;
    this.submitting = this.refs.create(ref).pipe(
      tap(() => {
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.ts.createResponse('plugin/user/vote/up', this.url.value).subscribe();
        }
      }),
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(tags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.completedUploads
          .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
        if (!taggingOps.length) return of(res);
        return forkJoin(taggingOps).pipe(map(() => res));
      }),
      catchError((res: HttpErrorResponse) => {
        delete this.submitting;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.submitting;
      this.textForm.markAsPristine();
      this.completedUploads = [];

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
  }
}
