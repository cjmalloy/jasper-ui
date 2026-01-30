import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, effect, Injector, OnDestroy, ViewChild } from '@angular/core';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';

import { catchError, forkJoin, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { NavComponent } from '../../../component/nav/nav.component';
import { LimitWidthDirective } from '../../../directive/limit-width.directive';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { OembedStore } from '../../../store/oembed';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { interestingTags } from '../../../util/format';
import { printError } from '../../../util/http';
import { getVisibilityTags } from '../../../util/tag';

@Component({
  selector: 'app-submit-web-page',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss'],
  host: { 'class': 'full-page-form' },
  imports: [

    ReactiveFormsModule,
    LimitWidthDirective,
    NavComponent,
    LoadingComponent,
    RefFormComponent,
  ],
})
export class SubmitWebPage implements AfterViewInit, OnDestroy, HasChanges {


  submitted = false;
  title = '';
  webForm: UntypedFormGroup;
  serverError: string[] = [];

  limitWidth?: HTMLElement;
  submitting?: Subscription;
  defaults?: { url: string, ref: Partial<Ref> };
  loadingDefaults: Ext[] = [];

  private oldSubmit: string[] = [];
  private _refForm?: RefFormComponent;

  constructor(
    private injector: Injector,
    private mod: ModService,
    private admin: AdminService,
    private router: Router,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private exts: ExtService,
    private ts: TaggingService,
    private oembeds: OembedStore,
    private scrape: ScrapeService,
    public bookmarks: BookmarkService,
    private fb: UntypedFormBuilder,
  ) {
    this.setTitle($localize`Submit: Web Link`);
    this.webForm = refForm(fb);
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.webForm?.dirty;
  }

  ngAfterViewInit(): void {
    this.url = this.store.submit.url?.trim();
    const allTags = [...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
    this.exts.getCachedExts(allTags).pipe(
      map(xs => xs.filter(x => x.config?.defaults) as Ext[]),
      switchMap(xs => {
        this.loadingDefaults = xs;
        return this.refs.getDefaults(...xs.map(x => x.tag))
      }),
    ).subscribe(d => {
      this.defaults = d;
      this.loadingDefaults = [];
      if (d) {
        this.oldSubmit = uniq([...allTags, ...Object.keys(d.ref.plugins || {})]);
        for (const k in d.ref.plugins) {
          if (k === this.store.submit.plugin) continue;
          this.addPlugin(k, d.ref.plugins[k]);
        }
        this.refForm.setRef({
          ...d.ref,
          tags: this.oldSubmit,
        });
      }
      if (this.store.account.localTag) this.addTag(this.store.account.localTag);
      effect(() => {
        const tags = [...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
        const added = without(tags, ...this.oldSubmit);
        const removed = without(this.oldSubmit, ...tags);
        if (added.length || removed.length) {
          this.oldSubmit = uniq([...without(this.oldSubmit, ...removed), ...added]);
          this.addTag(...this.oldSubmit);
        }
        if (this.store.submit.pluginUpload) {
          this.addPlugin(this.store.submit.plugin, { url: this.store.submit.pluginUpload });
          if (this.store.submit.plugin === 'plugin/image' || this.store.submit.plugin === 'plugin/video') {
            this.addTag('plugin/thumbnail');
          }
        }
        if (this.admin.getPlugin('plugin/thumbnail') && (
          this.store.submit.tags.includes('plugin/video') ||
          this.store.submit.tags.includes('plugin/image'))) {
          this.addTag('plugin/thumbnail');
        }
        if (this.origin) {
          this.addTag('internal');
          this.setTitle($localize`Replicate Remote Origin`);
        } else if (this.feed) {
          this.addTag('internal');
          this.setTitle($localize`Submit: Feed`);
        }
        if (this.store.submit.title) {
          this.webForm.get('title')!.setValue(this.store.submit.title);
        }
        let url = this.store.submit.url?.trim();
        if (this.store.submit.repost) {
          this.url = 'internal:' + uuid();
          this.addTag('plugin/repost');
          this.addSource(url);
        } else if (this.feed) {
          if (this.store.submit.tags.includes('public')) this.addFeedTags('public');
          this.addFeedTags(...interestingTags(this.store.submit.tags));
          this.scrape.rss(url).pipe(
            switchMap(value => {
              if (!value) return of(value);
              return this.refs.page({ url: value, size: 1, query: this.store.account.origin || '*', obsolete: null }).pipe(
                map(page => page.content.length > 0 ? undefined : value),
                catchError(() => of(value))
              );
            })
          ).subscribe(value => {
            if (value) {
              this.url = value;
              this.addTag('plugin/repost');
              this.addSource(url);
              this.refForm.scrapePlugins();
              if (url.startsWith('https://www.youtube.com/@') || url.startsWith('https://youtube.com/@')) {
                const username = url.substring(url.indexOf('@'));
                if (!this.store.submit.title) this.webForm.get('title')!.setValue(username);
                const tag = username.toLowerCase().replace(/[^a-z0-9]+/, '');
                this.addFeedTags(tag);
              } else if (!this.store.submit.title) {
                this.refForm.scrapeTitle();
              }
            } else {
              // Feed url already exists, just post the page and drop the feed plugin
              this.setTitle($localize`Submit: Web Link`);
              this.removeTag('plugin/script/feed', 'internal');
              this.bookmarks.tags = without(this.bookmarks.tags, 'plugin/script/feed', 'internal');
              if (url.startsWith('https://www.youtube.com/@') || url.startsWith('https://youtube.com/@')) {
                const username = url.substring(url.indexOf('@'));
                if (!this.store.submit.title) this.webForm.get('title')!.setValue(username);
              } else if (!this.store.submit.title) {
                this.refForm.scrapeTitle();
              }
            }
          });
        } else {
          this.oembeds.get(url).subscribe(oembed => {
            if (!this.store.submit.title) this.refForm.scrapeTitle();
            if (!oembed) return;
            if (oembed?.thumbnail_url) {
              this.addPlugin('plugin/thumbnail', { url: oembed.thumbnail_url });
            }
            if (oembed?.author_url) {
              this.addSource(oembed?.author_url);
            }
            if (oembed.url && oembed.type === 'photo') {
              this.addPlugin('plugin/image', { url: oembed.url });
            } else {
              this.addTag('plugin/embed');
            }
            if (oembed?.provider_name === 'Twitter') {
              let comment = oembed.html!.replace(/(<([^>]+)>)/gi, "").trim().replace(/\s+/gi, ' ');
              if (comment.length > 140) comment = comment.substring(0, 139) + '…';
              this.webForm.get('comment')!.setValue(comment);
            }
          });
        }
        if (this.store.submit.source) {
          this.store.submit.sources.map(s => this.addSource(s));
        }
      }, { injector: this.injector });
    });
  }

  ngOnDestroy() {
  }

  get refForm(): RefFormComponent {
    return this._refForm!;
  }

  @ViewChild('refForm')
  set refForm(value: RefFormComponent) {
    this._refForm = value;
    defer(() => this.limitWidth = value?.fill?.nativeElement);
  }

  get feed() {
    return !!this.webForm.value.tags.includes('plugin/script/feed');
  }

  get origin() {
    return !!this.webForm.value.tags.includes('+plugin/origin');
  }

  set url(value: string) {
    const plugins = this.admin.getPluginsForUrl(value);
    if (plugins.length) {
      this.addTag(...plugins.map(p => p.tag));
    }
    this.webForm.get('url')?.enable();
    defer(() => {
      this.webForm.get('url')?.setValue(value);
      this.webForm.get('url')?.disable();
    });
  }

  get url() {
    return this.webForm.get('url')?.value;
  }

  setTitle(title: string) {
    this.title = title;
    this.mod.setTitle(title);
  }

  addTag(...values: string[]) {
    for (const value of values) {
      this.refForm.tagsFormComponent.addTag(value);
    }
    this.submitted = false;
  }

  removeTag(...values: string[]) {
    for (const value of values) {
      this.refForm.tagsFormComponent.removeTag(value);
    }
    this.submitted = false;
  }

  addPlugin(tag: string, plugin: any) {
    this.refForm.tagsFormComponent.addTag(tag);
    this.refForm.pluginsFormComponent.setValue({
      ...this.webForm.value.plugins || {},
      [tag]: plugin,
    });
    this.submitted = false;
  }

  addSource(value = '') {
    this.refForm.sourcesFormComponent.addLink(value);
    this.submitted = false;
  }

  addAlt(value = '') {
    this.refForm.altsFormComponent.addLink(value);
    this.submitted = false;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.webForm);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.webForm.markAllAsTouched();
    this.syncEditor();
    if (!this.webForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = this.webForm.value.published ? DateTime.fromISO(this.webForm.value.published) : DateTime.now();
    const finalTags = this.webForm.value.tags;
    this.submitting = this.refs.create({
      ...this.webForm.value,
      url: this.url, // Need to pull separately since control is locked
      origin: this.store.account.origin,
      published,
      plugins: writePlugins(this.webForm.value.tags, this.webForm.value.plugins),
    }).pipe(
      tap(() => {
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.ts.createResponse('plugin/user/vote/up', this.url).subscribe();
        }
      }),
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(finalTags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.refForm.completedUploads
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
      this.webForm.markAsPristine();
      this.refForm.completedUploads = [];

      this.router.navigate(['/ref', this.url], { queryParams: { published }, replaceUrl: true});
    });
  }

  private addFeedTags(...tags: string[]) {
    if (!this.feed) return;
    tags = tags.filter(t => t !== 'plugin/script/feed');
    const ref = this.webForm.value || {};
    ref.plugins ||= {};
    ref.plugins['plugin/script/feed'] ||= {};
    ref.plugins['plugin/script/feed'].addTags = uniq([...ref.plugins['plugin/script/feed'].addTags || [], ...tags]);
    this.refForm.pluginsFormComponent.setValue(ref.plugins);
  }
}
