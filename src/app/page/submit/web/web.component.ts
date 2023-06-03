import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { AuthzService } from '../../../service/authz.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { OembedStore } from '../../../store/oembed';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { interestingTags } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-web-page',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss'],
})
export class SubmitWebPage implements AfterViewInit, OnDestroy, HasChanges {
  @HostBinding('class') css = 'full-page-form';

  private disposers: IReactionDisposer[] = [];

  submitted = false;
  title = '';
  webForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];

  @ViewChild(RefFormComponent)
  refForm?: RefFormComponent;

  private rssUrl?: string;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private auth: AuthzService,
    private router: Router,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private ts: TaggingService,
    private oembeds: OembedStore,
    private scrape: ScrapeService,
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
    defer(() => {
      this.addTag('public');
      this.addTag(this.store.account.localTag);
      this.disposers.push(autorun(() => {
        this.addTag(...this.store.submit.tags);
        if (this.feed) defer(() => this.refForm!.plugins.feed!.tags.addTag(...interestingTags(this.store.submit.tags)));
        if (this.admin.status.plugins.thumbnail && (
            this.store.submit.tags.includes('plugin/video') ||
            this.store.submit.tags.includes('plugin/image') ||
            this.store.submit.tags.includes('plugin/embed'))) {
          this.addTag('plugin/thumbnail')
        }
        if (this.origin) {
          this.addTag('internal');
          this.setTitle($localize`Replicate Remote Origin`);
        } else if (this.feed) {
          this.addTag('internal');
          this.setTitle($localize`Submit: Feed`);
        }
        let url = this.store.submit.url.trim();
        if (this.store.submit.repost) {
          this.url = 'internal:' + uuid();
          this.addTag('plugin/repost');
          this.addSource(url);
        } else {
          if (url.startsWith('https://www.youtube.com/channel/') || url.startsWith('https://www.youtube.com/@')) {
            if (!this.feed && this.auth.canAddTag('+plugin/feed')) {
              this.addTag('+plugin/feed');
            }
            if (url.startsWith('https://www.youtube.com/@')) {
              const username = url.substring('https://www.youtube.com/'.length);
              this.webForm.get('title')!.setValue(username);
              const tag = username.toLowerCase().replace(/[^a-z0-9]+/, '');
              this.addTag(tag);
              defer(() => this.refForm!.plugins.feed!.tags.addTag(tag));
            }
          }

          if (this.feed) {
            this.scrape.rss(url).subscribe(value => {
              if (value) {
                this.url = this.rssUrl = value;
              }
            });
          }
          this.oembeds.get(url).subscribe(oembed => {
            if (!oembed) return;
            this.addTag('plugin/embed');
            if (oembed?.thumbnail_url) {
              this.addTag('plugin/thumbnail');
            }
            if (oembed?.provider_name === 'Twitter') {
              let comment = oembed.html!.replace(/(<([^>]+)>)/gi, "").trim().replace(/\s+/gi, ' ');
              if (comment.length > 140) comment = comment.substring(0, 139) + '…';
              this.webForm.get('comment')!.setValue(comment);
            }
          });
          this.url = this.rssUrl || url;
        }
        if (this.store.submit.source) {
          this.store.submit.sources.map(s => this.addSource(s));
        }
        this.refForm!.scrapeTitle();
      }));
    });
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get feed() {
    return !!this.webForm.value.tags.includes('+plugin/feed');
  }

  get origin() {
    return !!this.webForm.value.tags.includes('+plugin/origin');
  }

  get feedForm() {
    return this.refForm!.plugins.feed;
  }

  set url(value: string) {
    const plugins = this.admin.getPluginsForUrl(value);
    if (this.feed && plugins.length) {
      this.feedForm!.tags.addTag(...plugins.map(p => p.tag));
    } else {
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
    this.theme.setTitle(title);
  }

  addTag(...values: string[]) {
    for (const value of values) {
      this.refForm!.tags.addTag(value);
    }
    this.submitted = false;
  }

  addPlugin(tag: string, plugin: any) {
    this.refForm!.tags.addTag(tag);
    this.refForm!.plugins.setValue({
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
    const tags = [...without(this.webForm.value.tags, ...this.admin.editorTags), ...this.plugins];
    const published = this.webForm.value.published ? moment(this.webForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.refs.create({
      ...this.webForm.value,
      url: this.url, // Need to pull separately since control is locked
      origin: this.store.account.origin,
      tags,
      published,
      plugins: writePlugins(tags, this.webForm.value.plugins),
    }).pipe(
      tap(() => {
        if (this.admin.status.plugins.voteUp) {
          this.ts.createResponse('plugin/vote/up', this.url).subscribe();
        }
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.webForm.markAsPristine();
      this.router.navigate(['/ref', this.url], { queryParams: { published }});
    });
  }
}
