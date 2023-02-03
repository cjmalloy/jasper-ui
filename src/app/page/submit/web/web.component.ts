import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { defer, flatten, without } from 'lodash-es';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { isAudio } from '../../../plugin/audio';
import { isKnownEmbed } from '../../../plugin/embed';
import { isImage } from '../../../plugin/image';
import { isKnownThumbnail } from '../../../plugin/thumbnail';
import { isVideo } from '../../../plugin/video';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
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
export class SubmitWebPage implements AfterViewInit {
  @HostBinding('class') css = 'full-page-form';

  submitted = false;
  title = '';
  webForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];

  @ViewChild(RefFormComponent)
  refForm!: RefFormComponent;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store,
    private editor: EditorService,
    private refs: RefService,
    private fb: UntypedFormBuilder,
  ) {
    this.setTitle('Submit: Web Link');
    this.webForm = refForm(fb);
  }

  ngAfterViewInit(): void {
    defer(() => {
      this.addTag('public');
      this.addTag(this.store.account.localTag);
      this.route.queryParams.subscribe(params => {
        if (params['tag']) {
          const tags = flatten([params['tag']]);
          for (const tag of tags) {
            this.addTag(...tag.split(/[:|!()]/));
          }
        }
        if (this.origin) {
          this.addTag('internal');
          this.setTitle('Replicate Remote Origin');
        } else if (this.feed) {
          this.addTag('internal');
          this.setTitle('Submit: Feed');
        }
        defer(() => {
          this.url = params['url'].trim();
          if (params['source']) {
            flatten([params['source']]).map(s => this.addSource(s));
          }
          if (params['scrape'] === 'true') {
            this.refForm.scrapeAll();
          }
        });
      });
    });
  }

  get feed() {
    return !!this.webForm.value.tags.includes('+plugin/feed');
  }

  get origin() {
    return !!this.webForm.value.tags.includes('+plugin/origin');
  }

  get feedForm() {
    return this.refForm.plugins.feed;
  }

  set url(value: string) {
    if (this.feed) {
      if (this.admin.status.plugins.embed && isKnownEmbed(value)) this.feedForm!.tags.addTag('plugin/embed');
    } else {
      if (this.admin.status.plugins.audio && isAudio(value)) this.addTag('plugin/audio');
      if (this.admin.status.plugins.video && isVideo(value)) this.addTag('plugin/video');
      if (this.admin.status.plugins.image && isImage(value)) this.addTag('plugin/image');
      if (this.admin.status.plugins.thumbnail && isKnownThumbnail(value)) this.addTag('plugin/thumbnail');
      if (this.admin.status.plugins.embed && isKnownEmbed(value)) this.addTag('plugin/embed');
    }
    this.webForm.get('url')?.setValue(value);
    this.webForm.get('url')?.disable();
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
      this.refForm.tags.addTag(value);
    }
    this.submitted = false;
  }

  addSource(value = '') {
    this.refForm.sources.addLink(value);
    this.submitted = false;
  }

  addAlt(value = '') {
    this.refForm.alts.addLink(value);
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
    const tags = [...without(this.webForm.value.tags, ...this.admin.editors), ...this.plugins];
    const published = moment(this.webForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    this.refs.create({
      ...this.webForm.value,
      url: this.url, // Need to pull separately since control is locked
      origin: this.store.account.origin,
      tags,
      published,
      plugins: writePlugins(tags, this.webForm.value.plugins),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', this.url], { queryParams: { published }});
    });
  }
}
