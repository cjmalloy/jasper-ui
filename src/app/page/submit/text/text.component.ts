import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostBinding, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { LinksFormComponent } from '../../../form/links/links.component';
import { refForm, RefFormComponent } from '../../../form/ref/ref.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { wikiTitleFormat, wikiUriFormat } from '../../../mods/wiki';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { printError } from '../../../util/http';
import { hasTag } from '../../../util/tag';

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
  advanced = false;
  serverError: string[] = [];

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  private _plugins: string[] = [];

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
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
      if (this.store.account.localTag) this.addTag(this.store.account.localTag);
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
          this.tags.tags!.clear();
          this.addTag(...this.store.submit.tags);
          if (this.store.account.localTag) this.addTag(this.store.account.localTag);
        }
        if (this.store.submit.thumbnail) {
          this.addTag('plugin/thumbnail');
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

  @ViewChild('advancedForm')
  set advancedForm(value: RefFormComponent) {
    if (value) {
      const ref = this.textForm.value;
      if (this.store.submit.thumbnail) {
        ref.plugins = {
          'plugin/thumbnail': { url: this.store.submit.thumbnail },
        };
      }
      value.setRef(ref);
    }
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

  get plugins(): string[] {
    return this._plugins;
  }

  set plugins(value: string[]) {
    const added = without(value, ...this._plugins);
    const removed = without(this._plugins, ...value);
    const newTags = uniq([...without(this.tags!.tags!.value, ...removed), ...added]);
    this.textForm.setControl('tags', this.fb.array(newTags));
    this._plugins = value;
  }

  syncTags(value: string[]) {
    this.bookmarks.toggleTag(...without(this.store.submit.tags, ...value));
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
    const ref = {
      ...this.textForm.value,
      url: this.url.value, // Need to pull separately since control is locked
      title: this.title.value, // Need to pull separately if disabled by wiki mode
      origin: this.store.account.origin,
      published,
      tags,
    };
    if (!this.advanced && this.store.submit.thumbnail && hasTag('plugin/thumbnail', ref)) {
      ref.plugins = {
        'plugin/thumbnail': { url: this.store.submit.thumbnail },
      };
    }
    this.refs.create(ref).pipe(
      tap(() => {
        if (this.admin.getPlugin('plugin/vote/up')) {
          this.ts.createResponse('plugin/vote/up', this.url.value).subscribe();
        }
      }),
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.textForm.markAsPristine();
      if (hasTag('plugin/thread', ref)) {
        this.router.navigate(['/ref', this.url.value, 'thread'], { queryParams: { published }});
      } else {
        this.router.navigate(['/ref', this.url.value], { queryParams: { published }});
      }
    });
  }
}
