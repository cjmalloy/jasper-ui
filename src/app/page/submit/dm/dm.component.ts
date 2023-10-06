import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, HostBinding, OnDestroy } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { ThemeService } from '../../../service/theme.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { QUALIFIED_TAG_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasPrefix } from '../../../util/tag';

@Component({
  selector: 'app-submit-dm',
  templateUrl: './dm.component.html',
  styleUrls: ['./dm.component.scss']
})
export class SubmitDmPage implements AfterViewInit, OnDestroy, HasChanges {
  @HostBinding('class') css = 'full-page-form';
  private disposers: IReactionDisposer[] = [];

  submitted = false;
  dmForm: UntypedFormGroup;
  plugins: string[] = [];
  serverError: string[] = [];

  defaultTo?: string;
  defaultNotes = $localize`Notes: ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}`;
  loadedParams = false;

  constructor(
    private config: ConfigService,
    private theme: ThemeService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
    private refs: RefService,
    private editor: EditorService,
    private fb: UntypedFormBuilder,
  ) {
    theme.setTitle($localize`Submit: Direct Message`);
    this.dmForm = fb.group({
      to: ['', [Validators.pattern(QUALIFIED_TAG_REGEX)]],
      title: [''],
      sources: [[]],
      comment: [''],
    });
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.dmForm?.dirty;
  }

  ngAfterViewInit(): void {
    defer(() => {
      this.disposers.push(autorun(() => {
        if (this.store.submit.textPlugin === 'plugin/inbox/ai') {
          this.to.setValue(this.store.submit.textPlugin);
          this.title.setValue($localize`Chat with AI`);
        }
        if (this.store.submit.textPlugin === 'plugin/inbox/dalle') {
          this.to.setValue(this.store.submit.textPlugin);
          this.title.setValue($localize`Draw something...`);
        }
        if (this.store.submit.sources) {
          this.sources.setValue(this.store.submit.sources)
        }
        if (this.store.submit.to) {
          this.to.setValue(this.store.submit.to);
        }
        if (!this.to.value || hasPrefix(this.to.value, 'user')) {
          this.defaultTo = $localize`DM from ${this.store.account.tag}`;
        } else if (this.to.value === this.config.support) {
          this.defaultTo = $localize`Support Request`;
        } else {
          this.defaultTo = $localize`Message to Moderators of ${this.to.value}`;
        }
        this.loadedParams = true;
      }));
    });
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get to() {
    return this.dmForm.get('to') as UntypedFormControl;
  }

  get title() {
    return this.dmForm.get('title') as UntypedFormControl;
  }

  get sources() {
    return this.dmForm.get('sources') as UntypedFormArray;
  }

  get comment() {
    return this.dmForm.get('comment') as UntypedFormControl;
  }

  get notes() {
    return !this.to.value || this.to.value === this.store.account.tag;
  }

  get tags() {
    return uniq([
      'internal', 'plugin/thread',
        ...(this.notes ?
            ['notes'] :
            ['dm', 'locked', ...this.to.value.split(/\s+/).map((t: string) => getMailbox(t, this.store.account.origin))]
        ),
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...this.plugins,
      ...this.store.submit.tags,
    ]);
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.dmForm);
  }

  submit() {
    this.serverError = [];
    this.submitted = true;
    this.dmForm.markAllAsTouched();
    if (!this.dmForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const url = 'comment:' + uuid();
    const published = this.dmForm.value.published ? moment(this.dmForm.value.published, moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : moment();
    this.refs.create({
      url,
      origin: this.store.account.origin,
      title: this.dmForm.value.title,
      comment: this.dmForm.value.comment,
      sources: this.dmForm.value.sources,
      published,
      tags: this.tags,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.dmForm.markAsPristine();
      this.router.navigate(['/ref', url], { queryParams: { published }});
    });
  }

  setDefaultTitle() {
    defer(() => {
      if (!this.loadedParams) {
        this.setDefaultTitle();
        return;
      }
      if (this.title.value && ![this.defaultTo, this.defaultNotes].includes(this.title.value)) return;
      this.title.setValue(this.notes ? this.defaultNotes : this.defaultTo);
    });
  }
}
