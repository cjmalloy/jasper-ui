import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { FormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash-es';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { refForm } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
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
export class SubmitTextPage implements AfterViewInit {

  url?: string;
  wiki = false;
  submitted = false;
  textForm: UntypedFormGroup;
  serverError: string[] = [];

  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private editor: EditorService,
    private account: AccountService,
    private refs: RefService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Submit: Text Post');
    this.textForm = refForm(fb);
  }

  ngAfterViewInit(): void {
    _.defer(() => {
      this.addTag('public');
      this.addTag(this.account.tag);
      this.route.queryParams.subscribe(params => {
        this.url = params['url'];
        this.wiki = !!this.url?.startsWith('wiki:');
        if (this.wiki) {
          this.url = wikiUriFormat(this.url!);
          this.theme.setTitle('Submit: Wiki');
          this.title.setValue(wikiTitleFormat(this.url?.substring('wiki:'.length)));
        }
        if (params['tag']) {
          this.addTag(...params['tag'].split(/[:|!()]/));
        }
      });
    });
  }

  get title() {
    return this.textForm.get('title') as UntypedFormControl;
  }

  get comment() {
    return this.textForm.get('comment') as UntypedFormControl;
  }

  addTag(...values: string[]) {
    if (!values) values = [''];
    for (const value of values) {
      this.tags.addTag(value);
    }
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
