import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { altsForm } from '../../../form/alts/alts.component';
import { pluginsForm, writePlugins } from '../../../form/plugins/plugins.component';
import { sourcesForm } from '../../../form/sources/sources.component';
import { addTag, tagsForm } from '../../../form/tags/tags.component';
import { isAudio } from '../../../plugin/audio';
import { isEmbed } from '../../../plugin/embed';
import { isImage } from '../../../plugin/image';
import { isVideo } from '../../../plugin/video';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-web-page',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss'],
})
export class SubmitWebPage implements OnInit {

  submitted = false;
  webForm: FormGroup;
  serverError: string[] = [];

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Submit: Web Link');
    this.webForm = fb.group({
      url: [''],
      published: [moment().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS), [Validators.required]],
      title: ['', [Validators.required]],
      comment: [''],
      sources: sourcesForm(this.fb, []),
      alternateUrls: altsForm(this.fb, []),
      tags: tagsForm(fb, ['public', account.tag]),
      plugins: pluginsForm(fb, []),
    });
    route.queryParams.subscribe(params => {
      this.url = params['url'].trim();
      if (params['tag']) {
        this.addTag(params['tag']);
      }
      if (params['source']) {
        this.addSource(params['source']);
      }
    });
    if (admin.status.plugins.emoji) {
      this.addTag('plugin/emoji');
    }
    if (admin.status.plugins.latex) {
      this.addTag('plugin/latex');
    }
  }

  ngOnInit(): void {
  }

  get published() {
    return this.webForm.get('published') as FormControl;
  }

  get title() {
    return this.webForm.get('title') as FormControl;
  }

  get comment() {
    return this.webForm.get('comment') as FormControl;
  }

  get tags() {
    return this.webForm.get('tags') as FormArray;
  }

  get sources() {
    return this.webForm.get('sources') as FormArray;
  }

  get alts() {
    return this.webForm.get('alternateUrls') as FormArray;
  }

  get plugins() {
    return this.webForm.get('plugins') as FormGroup;
  }

  set url(value: string) {
    if (this.admin.status.plugins.audio && isAudio(value)) this.addTag('plugin/audio');
    if (this.admin.status.plugins.video && isVideo(value)) this.addTag('plugin/video');
    if (this.admin.status.plugins.image && isImage(value)) this.addTag('plugin/image');
    if (this.admin.status.plugins.thumbnail && (isImage(value) || isVideo(value))) this.addTag('plugin/thumbnail');
    if (this.admin.status.plugins.embed && isEmbed(value)) this.addTag('plugin/embed');
    this.webForm.get('url')?.setValue(value);
  }

  addTag(value: string) {
    addTag(this.fb, this.tags, value);
    this.submitted = false;
  }

  addSource(value: string) {
    this.sources.push(this.fb.control(value, [Validators.required]));
    this.submitted = false;
  }

  removeSource(index: number) {
    this.sources.removeAt(index);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.webForm.markAllAsTouched();
    if (!this.webForm.valid) return;
    this.refs.create({
      ...this.webForm.value,
      published: moment(this.webForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
      plugins: writePlugins(this.webForm.value.plugins),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', this.webForm.value.url]);
    });
  }
}
