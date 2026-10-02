import {
  HttpErrorResponse
} from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, forwardRef, OnDestroy, ChangeDetectionStrategy, viewChild, effect, computed, signal, inject, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { debounce, defer, some, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { catchError, firstValueFrom, forkJoin, interval, map, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../../component/loading/loading.component';
import { SelectPluginComponent } from '../../../component/select-plugin/select-plugin.component';
import { AutofocusDirective } from '../../../directive/autofocus.directive';
import { FillWidthDirective } from '../../../directive/fill-width.directive';
import { LimitWidthDirective } from '../../../directive/limit-width.directive';
import { ResizeHandleDirective } from '../../../directive/resize-handle.directive';
import { EditorComponent } from '../../../form/editor/editor.component';
import { LinksFormComponent } from '../../../form/links/links.component';
import { PluginsFormComponent, writePlugins } from '../../../form/plugins/plugins.component';
import { TagsFormComponent } from '../../../form/tags/tags.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref } from '../../../model/ref';
import { getMailbox } from '../../../mods/mailbox';
import { AdminService } from '../../../service/admin.service';
import { ExtService } from '../../../service/api/ext.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { BookmarkService } from '../../../service/bookmark.service';
import { ConfigService } from '../../../service/config.service';
import { EditorService } from '../../../service/editor.service';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';
import { scrollToFirstInvalid, controlValue } from '../../../util/form';
import { QUALIFIED_TAGS_REGEX } from '../../../util/format';
import { printError } from '../../../util/http';
import { getVisibilityTags, hasPrefix, hasTag, localTag } from '../../../util/tag';

@Component({
  selector: 'app-submit-dm',
  templateUrl: './dm.component.html',
  styleUrls: ['./dm.component.scss'],
  host: { 'class': 'full-page-form' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    forwardRef(() => EditorComponent),
    ReactiveFormsModule,
    LimitWidthDirective,
    AutofocusDirective,
    SelectPluginComponent,
    PluginsFormComponent,
    MonacoEditorModule,
    ResizeHandleDirective,
    FillWidthDirective,
    TagsFormComponent,
    LoadingComponent,
  ]
})
export class SubmitDmPage implements AfterViewInit, OnDestroy, HasChanges {

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private _url = 'comment:' + uuid();

  private readonly _submitted = signal<boolean>(false);
  get submitted() { return this._submitted(); }
  set submitted(value: boolean) { this._submitted.set(value); }
  dmForm: UntypedFormGroup;
  private readonly _serverError = signal<string[]>([]);
  get serverError() { return this._serverError(); }
  set serverError(value: string[]) { this._serverError.set(value); }

  private readonly _limitWidth = signal<HTMLElement | undefined>(undefined);
  get limitWidth() { return this._limitWidth(); }
  set limitWidth(value: HTMLElement | undefined) { this._limitWidth.set(value); }

  readonly fill = viewChild<ElementRef>('fill');

  readonly editorComponent = viewChild<EditorComponent>('ed');

  readonly tagsFormComponent = viewChild<TagsFormComponent>('tagsFormComponent');

  private readonly _preview = signal<string>('');
  get preview() { return this._preview(); }
  set preview(value: string) { this._preview.set(value); }
  private readonly _editing = signal<boolean>(false);
  get editing() { return this._editing(); }
  set editing(value: boolean) { this._editing.set(value); }
  private readonly _autocomplete = signal<{ value: string, label: string }[]>([]);
  get autocomplete() { return this._autocomplete(); }
  set autocomplete(value: { value: string, label: string }[]) { this._autocomplete.set(value); }
  private readonly _submitting = signal<Subscription | undefined>(undefined);
  get submitting() { return this._submitting(); }
  set submitting(value: Subscription | undefined) { this._submitting.set(value); }
  private readonly _saving = signal<Subscription | undefined>(undefined);
  get saving() { return this._saving(); }
  set saving(value: Subscription | undefined) { this._saving.set(value); }
  private readonly _completedUploads = signal<Ref[]>([]);
  get completedUploads() { return this._completedUploads(); }
  set completedUploads(value: Ref[]) { this._completedUploads.set(value); }
  private cursor?: string;
  private showedError = false;
  private addedMailboxes: string[] = [];
  private searching?: Subscription;
  private readonly tagsValue = controlValue<string[]>(() => this.tags);

  constructor(
    public config: ConfigService,
    private mod: ModService,
    public admin: AdminService,
    private router: Router,
    public store: Store,
    public bookmarks: BookmarkService,
    private refs: RefService,
    private exts: ExtService,
    private ts: TaggingService,
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
    effect(() => {
      const fill = this.fill();
      defer(() => this.limitWidth = fill?.nativeElement);
    });
    if (this.admin.editing) {
      interval(5_000).pipe(
        takeUntilDestroyed(),
      ).subscribe(() => {
        if (this.dmForm.dirty) this.saveForLater();
      });
    }
  }

  async saveChanges() {
    if (this.admin.editing && this.dmForm.dirty) {
      return firstValueFrom(this.refs.saveEdit(this.writeRef(), this.cursor)
        .pipe(map(() => true), catchError(() => of(false))));
    }
    return !this.dmForm?.dirty;
  }

  ngAfterViewInit() {
    effect(() => {
      if (this.store.submit.dmPlugin) {
        this.setTo(this.store.submit.dmPlugin);
      } if (this.store.submit.to.length) {
        this.setTo(this.store.submit.to.join(' '));
      } else {
        this.setTo('');
      }
      const tags = [...this.store.submit.tags, ...(this.store.account.localTag ? [this.store.account.localTag] : [])];
      if (tags.length) this.addTags(tags);
    }, { injector: this.injector });
  }

  ngOnDestroy() {
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

  saveForLater(leave = false) {
    const savedValue = JSON.stringify(this.dmForm.value);
    this.saving = this.refs.saveEdit(this.writeRef(), this.cursor)
      .pipe(catchError(err => {
        this.saving = undefined;
        return throwError(() => err);
      }))
      .subscribe(cursor => {
        this.saving = undefined;
        this.cursor = cursor;
        if (JSON.stringify(this.dmForm.value) === savedValue) this.dmForm.markAsPristine();
        if (leave) this.router.navigate(['/inbox/ref', 'plugin/editing']);
      });
  }

  writeRef() {
    return <Ref> {
      url: this._url,
      origin: this.store.account.origin,
      title: this.dmForm.value.title,
      comment: this.dmForm.value.comment,
      sources: this.dmForm.value.sources,
      tags: this.dmForm.value.tags,
      plugins: writePlugins(this.dmForm.value.tags, this.dmForm.value.plugins),
    };
  }

  addTags(value: string[]) {
    const tagsFormComponent = this.tagsFormComponent();
    if (!tagsFormComponent?.tags) {
      defer(() => {
        if (!this.destroyRef.destroyed) this.addTags(value);
      });
      return;
    }
    tagsFormComponent.setTags(uniq([...this.tags.value, ...value]));
  }

  setTags(value: string[]) {
    const tagsFormComponent = this.tagsFormComponent();
    if (!tagsFormComponent?.tags) {
      defer(() => {
        if (!this.destroyRef.destroyed) this.setTags(value);
      });
      return;
    }
    tagsFormComponent.setTags(value);
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
      this.config.tag(input.value);
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
    forkJoin(value.split(/[,\s]+/).filter(t => !!t).map( part => this.preview$(part))).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(xs => {
      this.preview = xs.map(x => x?.name || x?.tag || '').join(',  ');
    });
  }

  getMailboxes(tag: string): string[] {
    return this.admin.getPlugin(tag)?.config?.reply || [ getMailbox(tag, this.store.account.origin), ...hasPrefix(tag, '+user') ? [localTag(tag).substring(1)] : [] ];
  }

  readonly codeLang = computed(() => {
    for (const t of this.tagsValue() || []) {
      if (hasPrefix(t, 'plugin/code')) {
        return t.split('/')[2];
      }
    }
    return '';
  });

  readonly codeOptions = computed(() => ({
    language: this.codeLang(),
    theme: this.store.darkTheme ? 'vs-dark' : 'vs',
    automaticLayout: true,
  }));

  readonly customEditor = computed(() => {
    const tags = this.tagsValue();
    if (!tags) return false;
    return some(this.admin.editor, t => hasTag(t.tag, tags));
  });

  get top() {
    return this.sources.value[1] || this.sources.value[0] || this._url;
  }

  addSource(value = '') {
    while (this.sources.value.length < 2) {
      this.sources.push(this.fb.control(this.top, LinksFormComponent.validators));
    }
    this.sources.push(this.fb.control(value, LinksFormComponent.validators));
    this.submitted = false;
  }

  syncEditor() {
    this.editor.syncEditor(this.fb, this.dmForm);
  }

  submit() {
    if (this.saving) {
      this.saving.add(() => this.submit());
      return;
    }
    this.serverError = [];
    this.submitted = true;
    this.dmForm.markAllAsTouched();
    if (!this.dmForm.valid) {
      scrollToFirstInvalid();
      return;
    }
    const url = this._url;
    const published = this.dmForm.value.published ? DateTime.fromISO(this.dmForm.value.published) : DateTime.now();
    let sources = [url, ...uniq([url, ...this.store.submit.sources, ...this.dmForm.value.sources])];
    if (sources.length === 2) sources = [];
    const finalTags = this.dmForm.value.tags;
    const ref = {
      url,
      origin: this.store.account.origin,
      title: this.dmForm.value.title,
      comment: this.dmForm.value.comment,
      sources,
      published,
      tags: finalTags,
      plugins: writePlugins(this.dmForm.value.tags, this.dmForm.value.plugins),
    };
    this.submitting = (this.cursor ? this.refs.update({ ...ref, modifiedString: this.cursor }) : this.refs.create(ref)).pipe(
      switchMap(res => {
        const finalVisibilityTags = getVisibilityTags(finalTags);
        if (!finalVisibilityTags.length) return of(res);
        const taggingOps = this.completedUploads
          .map(upload => this.ts.patch(finalVisibilityTags, upload.url, upload.origin));
        if (!taggingOps.length) return of(res);
        return forkJoin(taggingOps).pipe(map(() => res));
      }),
      catchError((res: HttpErrorResponse) => {
        this.submitting = undefined;
        this.serverError = printError(res);
        return throwError(() => res);
      }),
    ).subscribe(() => {
      this.submitting = undefined;
      this.dmForm.markAsPristine();
      this.completedUploads = [];

      this.router.navigate(['/ref', url, 'thread'], { queryParams: { published }, replaceUrl: true});
    });
  }
}
