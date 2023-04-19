import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { defer, flatten, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { catchError, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { AdminService } from '../../../service/admin.service';
import { OEmbedService } from '../../../service/api/oembed.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-web-page',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss'],
})
export class SubmitWebPage implements AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'full-page-form';

  private disposers: IReactionDisposer[] = [];

  submitted = false;
  title = '';
  webForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];

  @ViewChild(RefFormComponent)
  refForm?: RefFormComponent;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private ts: TaggingService,
    private oembeds: OEmbedService,
    private fb: UntypedFormBuilder,
  ) {
    this.setTitle($localize`Submit: Web Link`);
    this.webForm = refForm(fb);
  }

  ngAfterViewInit(): void {
    defer(() => {
      this.addTag('public');
      this.addTag(this.store.account.localTag);
      this.disposers.push(autorun(() => {
        if (this.store.submit.tag) {
          for (const tag of this.store.submit.tags) {
            this.addTag(...tag.split(/[:|!()]/));
          }
        }
        if (this.origin) {
          this.addTag('internal');
          this.setTitle($localize`Replicate Remote Origin`);
        } else if (this.feed) {
          this.addTag('internal');
          this.setTitle($localize`Submit: Feed`);
        }
        this.url = this.store.submit.url.trim();
        if (this.store.submit.source) {
          this.store.submit.sources.map(s => this.addSource(s));
        }
        if (this.store.submit.scrape) {
          this.refForm!.scrapeAll();
        }
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
    this.webForm.get('url')?.setValue(value);
    this.webForm.get('url')?.disable();
    this.oembeds.get(value).subscribe(oembed => {
      this.addTag('plugin/embed');
      if (oembed.thumbnail_url) {
        this.addTag('plugin/thumbnail');
      }
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
    if (!values) values = [''];
    for (const value of values) {
      this.refForm!.tags.addTag(value);
    }
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
      this.router.navigate(['/ref', this.url], { queryParams: { published }});
    });
  }
}
