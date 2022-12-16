import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { refForm } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { wikiTitleFormat, wikiUriFormat } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
})
export class SubmitTextPage implements AfterViewInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  wiki = false;
  submitted = false;
  textForm: UntypedFormGroup;
  advanced = false;
  serverError: string[] = [];

  emoji = !!this.admin.status.plugins.emoji;
  latex = !!this.admin.status.plugins.latex;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    private editor: EditorService,
    private refs: RefService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle('Submit: Text Post');
    this.textForm = refForm(fb);
  }

  ngAfterViewInit(): void {
    _.defer(() => {
      this.addTag('public');
      this.addTag(this.store.account.localTag);
      this.disposers.push(autorun(() => {
        let url = this.store.submit.url || 'comment:' + uuid();
        if (this.store.submit.wiki) {
          url = wikiUriFormat(url);
          this.theme.setTitle('Submit: Wiki');
          this.title.setValue(wikiTitleFormat(url.substring('wiki:'.length)));
        }
        this.url.setValue(url);
        for (const tag of this.store.submit.tags) {
          this.addTag(...tag.split(/[:|!()]/));
        }
      }));
    });
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get url() {
    return this.textForm.get('url') as UntypedFormControl;
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
    if (this.advanced) return tags;
    const result = [...tags];
    if (this.emoji) result.push('plugin/emoji');
    if (this.latex) result.push('plugin/latex');
    return result;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.textForm);
  }

  setAdvanced() {
    this.advanced = true;
    if (this.emoji) this.addTag('plugin/emoji');
    if (this.latex) this.addTag('plugin/latex');
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.textForm.markAllAsTouched();
    this.syncEditor();
    if (!this.textForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const published = this.textForm.value.published ? moment(this.textForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.refs.create({
      ...this.textForm.value,
      origin: this.store.account.origin,
      tags: this.addPlugins(this.textForm.value.tags),
      published,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.router.navigate(['/ref', this.textForm.value.url, 'sources'], { queryParams: { published }});
    });
  }
}
