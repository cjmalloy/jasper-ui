import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, Subscription, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
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

@Component({
  standalone: false,
  selector: 'app-submit-web-page',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss'],
  host: {'class': 'full-page-form'}
})
export class SubmitWebPage implements AfterViewInit, OnDestroy, HasChanges {

  private disposers: IReactionDisposer[] = [];

  submitted = false;
  title = '';
  webForm: UntypedFormGroup;
  serverError: string[] = [];

  @ViewChild(RefFormComponent)
  refForm?: RefFormComponent;

  submitting?: Subscription;

  constructor(
    private mod: ModService,
    private admin: AdminService,
    private router: Router,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
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
    if (this.store.account.localTag) this.addTag(this.store.account.localTag);
    this.disposers.push(autorun(() => {
      this.addTag(...this.store.submit.tags);
      if (this.store.submit.thumbnail) {
        this.addPlugin('plugin/thumbnail', { url: this.store.submit.thumbnail });
      }
      if (this.admin.getPlugin('plugin/thumbnail') && (
          this.store.submit.tags.includes('plugin/video') ||
          this.store.submit.tags.includes('plugin/image'))) {
        this.addTag('plugin/thumbnail')
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
        this.scrape.rss(url).subscribe(value => {
          if (value) {
            this.url = value;
            this.addTag('plugin/repost');
            this.addSource(url);
            this.refForm!.scrapePlugins();
            if (url.startsWith('https://www.youtube.com/@') || url.startsWith('https://youtube.com/@')) {
              const username = url.substring(url.indexOf('@'));
              if (!this.store.submit.title) this.webForm.get('title')!.setValue(username);
              const tag = username.toLowerCase().replace(/[^a-z0-9]+/, '');
              this.addFeedTags(tag);
            } else if (!this.store.submit.title) {
              this.refForm!.scrapeTitle();
            }
          } else {
            this.url = url;
          }
        });
      } else {
        this.oembeds.get(url).subscribe(oembed => {
          if (!oembed) {
            if (!this.store.submit.title) this.refForm!.scrapeTitle();
            return;
          }
          if (oembed?.thumbnail_url) {
            this.addPlugin('plugin/thumbnail', { url: oembed.thumbnail_url });
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
        this.url = url;
      }
      if (this.store.submit.source) {
        this.store.submit.sources.map(s => this.addSource(s));
      }
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get feed() {
    return !!this.webForm.value.tags.includes('plugin/feed');
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
      this.refForm!.tagsFormComponent.addTag(value);
    }
    this.submitted = false;
  }

  addPlugin(tag: string, plugin: any) {
    this.refForm!.tagsFormComponent.addTag(tag);
    this.refForm!.plugins.setValue({
      ...this.webForm.value.plugins,
      [tag]: plugin,
    });
    this.submitted = false;
  }

  addSource(value = '') {
    this.refForm!.sources.addLink(value);
    this.submitted = false;
  }

  addAlt(value = '') {
    this.refForm!.alts.addLink(value);
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
    this.submitting = this.refs.create({
      ...this.webForm.value,
      url: this.url, // Need to pull separately since control is locked
      origin: this.store.account.origin,
      published,
      plugins: writePlugins(this.webForm.value.tags, this.webForm.value.plugins),
    }).pipe(
      tap(() => {
        if (this.admin.getPlugin('plugin/vote/up')) {
          this.ts.createResponse('plugin/vote/up', this.url).subscribe();
        }
      }),
      catchError((res: HttpErrorResponse) => {
        delete this.submitting;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.submitting;
      this.webForm.markAsPristine();
      this.router.navigate(['/ref', this.url], { queryParams: { published }, replaceUrl: true});
    });
  }

  private addFeedTags(...tags: string[]) {
    if (!this.feed) return;
    tags = tags.filter(t => t !== 'plugin/feed');
    const ref = this.webForm.value || {};
    ref.plugins ||= {};
    ref.plugins['plugin/feed'] ||= {};
    ref.plugins['plugin/feed'].addTags = uniq([...ref.plugins['plugin/feed'].addTags || [], ...tags]);
    this.refForm!.plugins.setValue(ref.plugins);
  }
}
