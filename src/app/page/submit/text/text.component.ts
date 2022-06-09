import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { addTag } from 'src/app/form/tags/tags.component';
import { v4 as uuid } from 'uuid';
import { addAlt } from '../../../form/alts/alts.component';
import { refForm } from '../../../form/ref/ref.component';
import { addSource } from '../../../form/sources/sources.component';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { wikiTitleFormat, wikiUriFormat } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
})
export class SubmitTextPage implements OnInit {

  url?: string;
  wiki = false;
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
    private editor: EditorService,
    private account: AccountService,
    private refs: RefService,
    private fb: FormBuilder,
  ) {
    theme.setTitle('Submit: Text Post');
    this.textForm = refForm(fb);
    addTag(fb, this.textForm, 'public');
    addTag(fb, this.textForm, account.tag);
    route.queryParams.subscribe(params => {
      this.url = params['url'];
      this.wiki = !!this.url?.startsWith('wiki:');
      if (this.wiki) {
        this.url = wikiUriFormat(this.url!);
        theme.setTitle('Submit: Wiki');
        this.title.setValue(wikiTitleFormat(this.url?.substring('wiki:'.length)));
      }
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

  get sources() {
    return this.textForm.get('sources') as FormArray;
  }

  get alts() {
    return this.textForm.get('alternateUrls') as FormArray;
  }

  get tags() {
    return this.textForm.get('tags') as FormArray;
  }

  addTag(value = '') {
    addTag(this.fb, this.textForm, value);
    this.submitted = false;
  }

  addSource(value = '') {
    addSource(this.fb, this.textForm, value);
    this.submitted = false;
  }

  addAlt(value = '') {
    addAlt(this.fb, this.textForm, value);
    this.submitted = false;
  }

  addPlugins(tags: string[]) {
    const result = [...tags];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.textForm);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.textForm.markAllAsTouched();
    this.syncEditor();
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
