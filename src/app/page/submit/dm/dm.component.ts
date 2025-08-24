import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounce, defer, some, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, forkJoin, map, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { LinksFormComponent } from '../../../form/links/links.component';
import { writePlugins } from '../../../form/plugins/plugins.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Plugin } from '../../../model/plugin';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid } from '../../../util/form';
import { QUALIFIED_TAGS_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { hasTag } from '../../../util/tag';

@Component({
  standalone: false,
  selector: 'app-submit-dm',
  templateUrl: './dm.component.html',
  styleUrls: ['./dm.component.scss'],
  host: {'class': 'full-page-form'}
})
export class SubmitDmPage implements AfterViewInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  submitted = false;
  dmForm: UntypedFormGroup;
  serverError: string[] = [];

  @ViewChild('fill')
  fill?: ElementRef;

  @ViewChild(TagsFormComponent)
  tagsFormComponent?: TagsFormComponent;

  preview = '';
  editing = false;
  autocomplete: { value: string, label: string }[] = [];
  submitting?: Subscription;
  private showedError = false;
  private addedMailboxes: string[] = [];
  private searching?: Subscription;

  constructor(
    private config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
    private refs: RefService,
    private exts: ExtService,
    private editor: EditorService,
    private fb: UntypedFormBuilder,
  ) {
    mod.setTitle($localize`Submit: Direct Message`);
    this.dmForm = fb.group({
      to: ['', [Validators.pattern(QUALIFIED_TAGS_REGEX)]],
      title: [''],
      sources: fb.array([]),
      comment: [''],
      tags: fb.array([]),
    });
  }

  saveChanges() {
    // TODO: Just save in drafts
    return !this.dmForm.dirty;
  }

  ngAfterViewInit() {
    this.disposers.push(autorun(() => {
      if (this.store.submit.dmPlugin) {
        this.setTo(this.store.submit.dmPlugin);
      } if (this.store.submit.to.length) {
        this.setTo(this.store.submit.to.join(' '));
      } else {
        this.setTo('');
      }
      this.addTags([...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])]);
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

  get tags() {
    return this.dmForm.get('tags') as UntypedFormArray;
  }

  get notes() {
    return !this.to.value || this.to.value === this.store.account.tag;
  }

  addTags(value: string[]) {
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.addTags(value));
      return;
    }
    this.tagsFormComponent.setTags(uniq([...this.tags.value, ...value]));
  }

  setTags(value: string[]) {
    if (!this.tagsFormComponent?.tags) {
      defer(() => this.setTags(value));
      return;
    }
    this.tagsFormComponent.setTags(value);
  }

  get showError() {
    return this.to.touched && this.to.errors?.['pattern'];
  }

  validate(input: HTMLInputElement) {
    if (this.showError) {
      input.setCustomValidity($localize`
        User tags must start with the "+user/" or "_user/" prefix.
        Notification tags must start with the "plugin/inbox" or "plugin/outbox" prefix.
        Tags must be lower case letters, numbers, periods and forward slashes.
        Must not or contain two forward slashes or periods in a row.
        (i.e. "+user/bob", "plugin/outbox/dictionary/science", or "_user/charlie@jasperkm.info")`);
      input.reportValidity();
    }
  }

  setTo(value: string) {
    this.to.setValue(value);
    this.getPreview(value);
    this.changedTo(value);
  }

  changedTo(value: string) {
    const notes = !value || value === this.store.account.tag;
    if (notes && !hasTag('notes', this.tags.value)) {
      const newTags = uniq([...without(this.tags.value, ...['dm', 'plugin/thread', ...this.addedMailboxes]), 'notes']);
      this.setTags(newTags);
      this.addedMailboxes = [];
    } else if (!notes) {
      const mailboxes = ['dm', 'plugin/thread', ...value.toLowerCase().split(/[,\s]+/).filter(t => !!t).flatMap((t: string) => this.getMailboxes(t))];
      const added = without(mailboxes, ...this.addedMailboxes);
      const removed = without(this.addedMailboxes, ...mailboxes);
      const newTags = uniq([...without(this.tags.value, ...removed, 'notes'), ...added]);
      this.setTags(newTags);
      this.addedMailboxes = mailboxes;
    }
  }

  preview$(value: string): Observable<{ name?: string, tag: string } | undefined> {
    return this.editor.getTagPreview(value, this.store.account.origin);
  }

  edit(input: HTMLInputElement) {
    this.editing = true;
    this.preview = '';
    input.focus();
  }

  clickPreview(input: HTMLInputElement) {
    if (this.store.hotkey) {
      window.open(this.config.base + 'tag/' + input.value);
    } else {
      this.edit(input);
    }
  }

  search = debounce((input: HTMLInputElement) => {
    const text = input.value.replace(/[,\s]+$/, '');
    const parts = text.split(/[,\s]+/).filter(t => !!t);
    const value = parts.pop() || '';
    const prefix = text.substring(0, text.length - value.length)
    const tag = value.replace(/[^_+a-z0-9./]/, '').toLowerCase();
    this.searching?.unsubscribe();
    this.searching = this.exts.page({
      query: '+user|_user',
      search: tag,
      size: 1,
    }).pipe(
      switchMap(page => page.page.totalElements ? forkJoin(page.content.map(x => this.preview$(x.tag + x.origin))) : of([])),
      map(xs => xs.filter(x => !!x) as { name?: string, tag: string }[]),
    ).subscribe(xs => {
      this.autocomplete = xs.map(x => ({ value: prefix + x.tag, label: x.name || x.tag }));
    });
  }, 400);

  blur(input: HTMLInputElement) {
    this.editing = false;
    if (this.showError && !this.showedError) {
      this.showedError = true;
      defer(() => this.validate(input));
    } else {
      this.showedError = false;
      this.setTo(input.value);
      this.getPreview(input.value) ;
    }
  }

  getPreview(value: string) {
    if (!value) return;
    if (this.showedError) return;
    forkJoin(value.split(/[,\s]+/).filter(t => !!t).map( part => this.preview$(part))).subscribe(xs => {
      this.preview = xs.map(x => x?.name || x?.tag || '').join(',  ');
    });
  }

  getMailboxes(tag: string): string[] {
    return this.admin.getPlugin(tag)?.config?.reply || [ getMailbox(tag, this.store.account.origin) ];
  }

  get editingViewer() {
    return some(this.admin.editingViewer, (t: Plugin) => hasTag(t.tag, this.tags.value));
  }

  addSource(value = '') {
    this.sources.push(this.fb.control(value, LinksFormComponent.validators));
    this.submitted = false;
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
      sources: this.store.submit.sources,
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
      this.router.navigate(['/ref', url, 'thread'], { queryParams: { published }, replaceUrl: true});
    });
  }
}
