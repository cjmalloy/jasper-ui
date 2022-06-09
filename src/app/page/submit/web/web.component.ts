import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { addAlt } from '../../../form/alts/alts.component';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { refForm } from '../../../form/ref/ref.component';
import { addSource } from '../../../form/sources/sources.component';
import { addTag } from '../../../form/tags/tags.component';
import { isAudio } from '../../../plugin/audio';
import { isKnownEmbed } from '../../../plugin/embed';
import { isImage } from '../../../plugin/image';
import { isKnownThumbnail } from '../../../plugin/thumbnail';
import { isVideo } from '../../../plugin/video';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
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
    private editor: EditorService,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Submit: Web Link');
    this.webForm = refForm(fb);
    addTag(fb, this.webForm, 'public');
    addTag(fb, this.webForm, account.tag);
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
    if (this.admin.status.plugins.thumbnail && isKnownThumbnail(value)) this.addTag('plugin/thumbnail');
    if (this.admin.status.plugins.embed && isKnownEmbed(value)) this.addTag('plugin/embed');
    this.webForm.get('url')?.setValue(value);
  }

  addTag(value = '') {
    addTag(this.fb, this.webForm, value);
    this.submitted = false;
  }

  addSource(value = '') {
    addSource(this.fb, this.webForm, value);
    this.submitted = false;
  }

  addAlt(value = '') {
    addAlt(this.fb, this.webForm, value);
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
