import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostBinding, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LinksFormComponent } from '../../../form/links/links.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { wikiTitleFormat, wikiUriFormat } from '../../../mods/plugin/wiki';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';

@Component({
  selector: 'app-submit-text',
  templateUrl: './text.component.html',
  styleUrls: ['./text.component.scss'],
})
export class SubmitTextPage implements AfterViewInit, OnDestroy, HasChanges {
  @HostBinding('class') css = 'full-page-form';
  private disposers: IReactionDisposer[] = [];

  submitted = false;
  textForm: UntypedFormGroup;
  plugins: string[] = [];
  advanced = false;
  serverError: string[] = [];

  @ViewChild('fill')
  fill?: ElementRef;
  @ViewChild('advancedForm')
  advancedForm?: RefFormComponent;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    private editor: EditorService,
    private refs: RefService,
    private ts: TaggingService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Submit: Text Post`);
    this.textForm = refForm(fb);
    runInAction(() => store.submit.wikiPrefix = admin.getWikiPrefix());
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.textForm?.dirty;
  }

  ngAfterViewInit(): void {
    defer(() => {
      this.addTag('public');
      this.addTag(this.store.account.localTag);
      this.disposers.push(autorun(() => {
        let url = this.store.submit.url || 'comment:' + uuid();
        if (!this.admin.isWikiExternal() && this.store.submit.wiki) {
          url = wikiUriFormat(url, this.admin.getWikiPrefix());
          this.theme.setTitle($localize`Submit: Wiki`);
          this.title.setValue(wikiTitleFormat(url, this.admin.getWikiPrefix()));
          this.title.disable();
        }
        this.url.setValue(url);
        this.url.disable();
        if (this.store.submit.tags.length) {
          this.tags.tags.clear();
          this.addTag(...this.store.submit.tags);
          this.addTag(this.store.account.localTag);
        }
        for (const s of this.store.submit.sources) {
          this.addSource(s)
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

  get sources() {
    return this.textForm.get('sources') as UntypedFormArray;
  }

  addTag(...values: string[]) {
    this.tags.addTag(...values);
    this.submitted = false;
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, LinksFormComponent.validators))
    this.submitted = false;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.textForm);
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
    const tags = uniq([...(this.textForm.value.tags || []), ...this.plugins]);
    const published = this.textForm.value.published ? moment(this.textForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.refs.create({
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin,
      published,
      tags,
    }).pipe(
      tap(() => {
        if (this.admin.status.plugins.voteUp) {
          this.ts.createResponse('plugin/vote/up', this.url.value).subscribe();
        }
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.textForm.markAsPristine();
      this.router.navigate(['/ref', this.url.value], { queryParams: { published }});
    });
  }
}
