import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostBinding, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, some, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import * as moment from 'moment';
import { catchError, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { TagsFormComponent } from '../../../form/tags/tags.component';
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
  serverError: string[] = [];

  defaultTo?: string;
  defaultNotes = $localize`Notes: ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}`;
  loadedParams = false;

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild(TagsFormComponent)
  tags?: TagsFormComponent;

  private addedMailboxes: string[] = [];
  private _plugins: string[] = [];

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
      sources: fb.array([]),
      comment: [''],
      tags: fb.array([]),
    });
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.dmForm?.dirty;
  }

  ngAfterViewInit(): void {
    this.disposers.push(autorun(() => {
      if (this.store.submit.dmPlugin === '+plugin/ai/openai') {
        this.setTo('plugin/inbox/ai/openai');
        this.title.setValue($localize`Chat with AI`);
      } else if (this.store.submit.dmPlugin === '+plugin/ai/dalle') {
        this.setTo('plugin/inbox/ai/dalle');
        this.title.setValue($localize`Draw something...`);
      } if (this.store.submit.to.length) {
        this.setTo(this.store.submit.to.join(' '));
      } else {
        this.setTo('');
      }

      if (this.store.submit.sources) {
        this.sources.setValue(this.store.submit.sources)
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
    this.disposers.push(autorun(() => {
      this.tags!.tags!.clear();
      this.tags!.addTag('internal', 'plugin/thread', ...this.store.submit.tags || []);
      if (this.store.account.localTag) this.tags!.addTag(this.store.account.localTag);
    }));
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

  get plugins(): string[] {
    return this._plugins;
  }

  set plugins(value: string[]) {
    this.tags?.removeTag(...without(this._plugins, ...value));
    this.tags?.addTag(...without(value, ...this.addedMailboxes));
    this._plugins = value;
  }

  setTo(value: string) {
    this.to.setValue(value);
    this.changedTo(value);
  }

  changedTo(value: string) {
    defer(() => {
      const notes = !value || value === this.store.account.tag;
      if (notes && !this.tags?.includesTag('notes')) {
        this.tags?.removeTag('dm', 'locked', ...this.addedMailboxes);
        this.tags?.addTag('notes');
        this.addedMailboxes = [];
      } else if (!notes) {
        const mailboxes = ['dm', 'locked', ...value.split(/\s+/).flatMap((t: string) => this.getMailboxes(t))];
        const added = without(mailboxes, ...this.addedMailboxes);
        const removed = without(this.addedMailboxes, ...mailboxes);
        this.tags?.removeTag('notes', ...removed);
        this.tags?.addTag(...added);
        this.addedMailboxes.push(...added);
      }
    });
  }

  getMailboxes(tag: string): string[] {
    tag = getMailbox(tag, this.store.account.origin);
    return this.admin.getPlugin(tag)?.config?.reply || [ tag ];
  }

  get editingViewer() {
    return some(this.admin.editingViewer, t => this.tags?.includesTag(t.tag));
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
      tags: this.dmForm.value.tags,
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.dmForm.markAsPristine();
      this.router.navigate(['/ref', url, 'thread'], { queryParams: { published }});
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
