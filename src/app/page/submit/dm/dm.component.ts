import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, HostBinding, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { defer, some, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, Subscription, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Plugin } from '../../../model/plugin';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { QUALIFIED_TAG_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';

@Component({
  standalone: false,
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

  loadedParams = false;

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild(TagsFormComponent)
  tags?: TagsFormComponent;

  submitting?: Subscription;
  private addedMailboxes: string[] = [];
  private oldSubmit: string[] = [];

  constructor(
    private config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
    private refs: RefService,
    private editor: EditorService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Direct Message`);
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
      if (this.store.submit.dmPlugin) {
        this.setTo(this.store.submit.dmPlugin);
      } if (this.store.submit.to.length) {
        this.setTo(this.store.submit.to.join(' '));
      } else {
        this.setTo('');
      }

      if (this.store.submit.sources) {
        this.sources.setValue(this.store.submit.sources)
      }
      const tags = ['plugin/thread', ...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
      const added = without(tags, ...this.oldSubmit);
      const removed = without(this.oldSubmit, ...tags);
      if (added.length || removed.length) {
        const newTags = uniq([...without(this.tags!.tags!.value, ...removed), ...added]);
        this.tags!.setTags(newTags);
        this.oldSubmit = tags;
      }
      this.loadedParams = true;
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

  set editorTags(value: string[]) {
    if (this.tags?.tags) {
      const addTags = value.filter(t => !t.startsWith('-'));
      const removeTags = value.filter(t => t.startsWith('-')).map(t => t.substring(1));
      const newTags = uniq([...without(this.tags!.tags!.value, ...removeTags), ...addTags]);
      this.tags!.setTags(newTags);
    } else {
      defer(() => this.editorTags = value);
    }
  }

  validate(input: HTMLInputElement) {
    if (this.to.touched) {
      if (this.to.errors?.['pattern']) {
        input.setCustomValidity($localize`
          User tags must start with the "+user/" or "_user/" prefix.
          Notification tags must start with the "plugin/inbox" or "plugin/outbox" prefix.
          Tags must be lower case letters, numbers, periods and forward slashes.
          Must not or contain two forward slashes or periods in a row.
          (i.e. "+user/bob", "plugin/outbox/dictionary/science", or "_user/charlie@jasperkm.info")`);
        input.reportValidity();
        return;
      }
    }
    this.setTo(input.value);
  }

  syncTags(value: string[]) {
    this.bookmarks.toggleTag(...without(this.store.submit.tags, ...value));
  }

  setTo(value: string) {
    this.to.setValue(value);
    this.changedTo(value);
  }

  changedTo(value: string) {
    const notes = !value || value === this.store.account.tag;
    if (notes && !this.tags?.hasTag('notes')) {
      const newTags = uniq([...without(this.tags!.tags!.value, ...['dm', 'internal', ...this.addedMailboxes]), 'notes']);
      this.tags!.setTags(newTags);
      this.addedMailboxes = [];
    } else if (!notes) {
      const mailboxes = ['dm', 'internal', ...value.split(/\s+/).flatMap((t: string) => this.getMailboxes(t))];
      const added = without(mailboxes, ...this.addedMailboxes);
      const removed = without(this.addedMailboxes, ...mailboxes);
      const newTags = uniq([...without(this.tags!.tags!.value, ...removed, 'notes'), ...added]);
      this.tags!.setTags(newTags);
      this.addedMailboxes = mailboxes;
    }
  }

  getMailboxes(tag: string): string[] {
    return this.admin.getPlugin(tag)?.config?.reply || [ getMailbox(tag, this.store.account.origin) ];
  }

  get editingViewer() {
    return some(this.admin.editingViewer, (t: Plugin) => this.tags?.hasTag(t.tag));
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
    const published = this.dmForm.value.published ? DateTime.fromISO(this.dmForm.value.published) : DateTime.now();
    this.submitting = this.refs.create({
      url,
      origin: this.store.account.origin,
      title: this.dmForm.value.title,
      comment: this.dmForm.value.comment,
      sources: this.dmForm.value.sources,
      published,
      tags: this.dmForm.value.tags,
      plugins: writePlugins(this.dmForm.value.tags, this.dmForm.value.plugins),
    }).pipe(
      catchError((res: HttpErrorResponse) => {
        delete this.submitting;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      delete this.submitting;
      this.dmForm.markAsPristine();
      this.router.navigate(['/ref', url, 'thread'], { queryParams: { published }});
    });
  }
}
