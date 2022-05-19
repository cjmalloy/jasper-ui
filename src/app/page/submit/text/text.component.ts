import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { addTag, tagsForm } from 'src/app/form/tags/tags.component';
import { v4 as uuid } from 'uuid';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';
import { TAG_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
})
export class SubmitTextPage implements OnInit {

  url?: string;
  submitted = false;
  textForm: FormGroup;
  serverError: string[] = [];

  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Submit: Text Post');
    this.textForm = fb.group({
      title: ['', [Validators.required]],
      comment: [''],
      tags: tagsForm(fb, ['public', account.tag]),
    });
    route.queryParams.subscribe(params => {
      this.url = params['url'];
      if (params['tag']) {
        this.addTag(params['tag']);
      }
    });
  }

  ngOnInit(): void {
  }

  get title() {
    return this.textForm.get('title') as FormControl;
  }

  get comment() {
    return this.textForm.get('comment') as FormControl;
  }

  get tags() {
    return this.textForm.get('tags') as FormArray;
  }

  addTag(value = '') {
    addTag(this.fb, this.tags, value);
    this.submitted = false;
  }

  addPlugins(tags: string[]) {
    const result = [...tags];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.textForm.markAllAsTouched();
    if (!this.textForm.valid) return;
    const url = this.url || 'comment:' + uuid();
    this.refs.create({
      ...this.textForm.value,
      tags: this.addPlugins(this.textForm.value.tags),
      url,
      published: moment(),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', url]);
    });
  }
}
