import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import { HttpEventType } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  Injector,
  Input,
  input,
  OnChanges,
  OnDestroy,
  output,
  SimpleChanges,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, UntypedFormArray, UntypedFormControl } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import Europa from 'europa';
import { debounce, defer, delay, intersection, sortedLastIndex, uniq, without } from 'lodash-es';
import { catchError, filter, last, map, Observable, of, Subject, Subscription, switchMap, takeUntil, tap } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { LoadingComponent } from '../../component/loading/loading.component';
import { MdComponent } from '../../component/md/md.component';
import { AutofocusDirective } from '../../directive/autofocus.directive';
import { FillWidthDirective } from '../../directive/fill-width.directive';
import { LimitWidthDirective } from '../../directive/limit-width.directive';
import { Ref } from '../../model/ref';
import { EditorButton, sortOrder } from '../../model/tag';
import { mimeToCode } from '../../mods/media/code';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { readFileAsDataURL, readFileAsString } from '../../util/async';
import { memo, MemoCache } from '../../util/memo';
import { expandedTagsInclude, hasTag, test } from '../../util/tag';

export interface EditorUpload {
  id: string;
  name: string;
  progress: number;
  subscription?: Subscription;
  completed?: boolean;
  error?: string;
  ref?: Ref | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  host: { 'class': 'editor' },
  imports: [
    MdComponent,
    LoadingComponent,
    ReactiveFormsModule,
    FillWidthDirective,
    AutofocusDirective,
    LimitWidthDirective,
  ],
})
export class EditorComponent implements OnChanges, AfterViewInit, OnDestroy {
  private injector = inject(Injector);
  admin = inject(AdminService);
  private accounts = inject(AccountService);
  private auth = inject(AuthzService);
  private proxy = inject(ProxyService);
  private refs = inject(RefService);
  private ts = inject(TaggingService);
  store = inject(Store);
  private overlay = inject(Overlay);
  private router = inject(Router);
  private el = inject(ElementRef);
  private vc = inject(ViewContainerRef);
  private fb = inject(FormBuilder);

  private destroy$ = new Subject<void>();

  readonly id = input('editor-' + uuid());

  @HostBinding('class.stacked')
  stacked = true;
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @HostBinding('class.help')
  help = false;
  @HostBinding('class.md-preview')
  preview = this.store.local.showPreview;

  readonly helpButton = viewChild<ElementRef<HTMLButtonElement>>('helpButton');
  readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  readonly md = viewChild<MdComponent>('md');
  readonly hiddenMeasure = viewChild<ElementRef<HTMLTextAreaElement>>('hiddenMeasure');

  readonly helpTemplate = viewChild.required<TemplateRef<any>>('help');
  readonly refTemplate = viewChild.required<TemplateRef<any>>('ref');
  readonly fileUpload = viewChild.required<ElementRef<HTMLInputElement>>('fileUpload');

  readonly hasTags = input(true);
  readonly selectResponseType = input(false);
  readonly tags = input<UntypedFormArray>();
  @Input()
  createdTags: string[] = [];
  @Input()
  control!: UntypedFormControl;
  readonly autoFocus = input(false);
  readonly addButton = input(false);
  readonly url = input('');
  readonly addCommentTitle = input($localize `Add comment`);
  readonly addCommentLabel = input($localize `+ Add comment`);
  readonly fillWidth = input<HTMLElement>();
  readonly syncEditor = output<string>();
  readonly syncTags = output<string[]>();
  readonly addSource = output<string>();
  readonly scrape = output<void>();
  readonly uploadCompleted = output<Ref>();

  dropping = false;
  overlayRef?: OverlayRef;
  helpRef?: OverlayRef;
  toggleIndex = 0;
  initialFullscreen = false;
  focused?: boolean = false;
  progress = 0;
  uploads: EditorUpload[] = [];
  files = !!this.admin.getPlugin('plugin/file');
  loadingEvents: any = {};

  private _text? = '';
  private _editing = false;
  private _padding = 8;

  private europa?: Europa;
  private scrollTop = 0;
  private scrollTopFullscreen = 0;
  private selectionStart = 0;
  private selectionEnd = 0;
  private blurTimeout = 0;

  private scrollMap = new Map<number, number>();
  private sourceMap: number[] = [];

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.toggleFullscreen(false));
    effect(() => {
      this.loadingEvents[this.store.eventBus.event] = false;
    });
  }

  init() {
    MemoCache.clear(this);
    if (this.selectResponseType() && this.responseButtons.length) {
      this.toggleIndex = 0;
      const tags = this.tags()?.value || this.createdTags;
      for (const p of this.responseButtons) {
        if (hasTag(p.tag, tags)) {
          this.toggleIndex = this.responseButtons.indexOf(p);
        }
      }
    }
  }

  ngAfterViewInit(): void {
    effect(() => {
      const height = this.store.viewportHeight - 4;
      if (this.overlayRef) {
        this.overlayRef.updateSize({ height });
        document.body.style.height = height + 'px';
        this.el.nativeElement.style.setProperty('--viewport-height', height + 'px');
      }
    }, { injector: this.injector });
    const tags = this.tags();
    if (tags) {
      tags.valueChanges.pipe(
        takeUntil(this.destroy$),
      ).subscribe(() => {
        this.init();
      });
    } else {
      this.init();
      this.updateTags(this.editing ? this.initTags : this.allTags);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tags || changes.createdTags || changes.url) {
      this.init();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.body.style.height = '';
    document.body.classList.remove('fullscreen');
    this.el.nativeElement.style.setProperty('--viewport-height', this.store.viewportHeight + 'px');
  }

  @Input()
  set scraping(value: boolean) {
    this.loadingEvents['scrape-done'] = value;
  }

  @HostListener('window:scroll')
  preventScroll() {
    if (this.overlayRef) {
      window.scrollTo(0, 0);
    }
  }

  onSelect(event?: MouseEvent) {
    if (event && !event.button) return;
    defer(() => {
      this.selectionStart = this.editor()?.nativeElement.selectionStart || 0;
      this.selectionEnd = this.editor()?.nativeElement.selectionEnd || 0;
      if (this.selectionEnd > this.selectionStart) {
        this.onSelectEditor();
      }
    });
  }

  postProcessMarkdown() {
    this.sourceMap.length = 0;
    this.scrollMap.clear();
    this.el.nativeElement.querySelectorAll('[aria-posinset]').forEach((el: HTMLElement) => {
      const start = +el.getAttribute('aria-posinset')!;
      this.scrollMap.set(start, el.offsetTop);
      this.sourceMap.push(start);
    });
    this.sourceMap.sort((a, b) => a - b);
  }

  onSelectEditor() {
    const md = this.md();
    if (!this.preview || !this.fullscreen || !md) return;
    const start = this.sourceMap[Math.max(sortedLastIndex(this.sourceMap, this.selectionStart) - 1, 0)];
    md.el.nativeElement.scrollTop = (this.scrollMap.get(start) ?? 0) - md.el.nativeElement.clientHeight / 2;
  }

  onSelectPreview() {
    const editor = this.editor();
    const hiddenMeasure = this.hiddenMeasure();
    if (!this.preview || !this.fullscreen || !hiddenMeasure || !editor) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (!this.md()?.el.nativeElement?.contains(sel.anchorNode)) return;
    const anchorEl = (sel.anchorNode as Node).nodeType === Node.ELEMENT_NODE
      ? sel.anchorNode as HTMLElement
      : (sel.anchorNode as Node).parentElement;
    const sourceMap = anchorEl!.closest('[aria-posinset]');
    if (!sourceMap) return;
    const start = +sourceMap.getAttribute('aria-posinset')!;
    hiddenMeasure.nativeElement.style.width = editor.nativeElement.clientWidth + 'px';
    hiddenMeasure.nativeElement.value = this.currentText.slice(0, start);
    editor.nativeElement.scrollTop = hiddenMeasure.nativeElement.scrollHeight - editor.nativeElement.clientHeight / 2;
  }

  @HostBinding('class.add-button')
  get addButtonClass() {
    return this.addButton() && !this.editing && !this.currentText;
  }

  @HostBinding('style.padding.px')
  get padding(): number {
    if (this.fullscreen) return 0;
    return this._padding + 8;
  }

  set padding(value: number) {
    this._padding = value;
  }

  get editing(): boolean {
    return this._editing;
  }

  @HostBinding('class.editing')
  set editing(value: boolean) {
    if (!this._editing && value) {
      defer(() => {
        this._editing = true;
        this.updateTags(this.initTags);
      });
    }
  }

  @memo
  get allTags() {
    const tags = this.tags();
    return uniq([
      ...without(tags ? tags.value : this.createdTags, ...this.allResponseTags),
      ...this.responseTags,
    ]);
  }

  @memo
  get initTags() {
    return [
      ...without(intersection(this.store.account.defaultEditors(this.editors), this.editorButtons.filter(b => this.visible(b)).map(b => b.toggle!)), ...this.allTags),
      ...this.allTags,
    ];
  }

  @memo
  get editors() {
    return this.editorButtons.map(p => p?.toggle as string).filter(p => !!p);
  }

  @memo
  get editorButtons(): EditorButton[] {
    return sortOrder(this.admin.getEditorButtons(this.allTags, this.scheme)).reverse();
  }

  @memo
  get responseButtons() {
    return this.admin.responseButton;
  }

  @memo
  get editorRibbons() {
    return sortOrder(this.editorButtons.filter(b => b.ribbon && this.visible(b)).map(b => this.setButtonOn(b)));
  }

  @memo
  get editorPushButtons() {
    return sortOrder(this.editorButtons.filter(b => !b.ribbon && this.visible(b)).map(b => this.setButtonOn(b)));
  }

  @memo
  get responseTags() {
    if (!this.selectResponseType() || !this.responseButtons.length) return [];
    const p = this.responseButtons[this.toggleIndex];
    return p.config?.reply || [p.tag];
  }

  @memo
  get allResponseTags() {
    if (!this.selectResponseType()) return [];
    return this.responseButtons.flatMap(p => p.config?.reply || [p.tag]);
  }

  @memo
  get scheme() {
    const url = this.url();
    if (!url) return '';
    if (!url.includes(':')) return '';
    return url.substring(0, url.indexOf(':') + 1);
  }

  get currentText() {
    return this._text || this.control?.value || '';
  }

  updateTags(tags: string[]) {
    if (!this.tags()) {
      this.createdTags = tags;
      MemoCache.clear(this);
    }
    this.syncTags.emit(tags);
  }

  toggleTag(button: EditorButton) {
    if (button.event) this.fireEvent(button);
    const toggle = button.toggle!;
    if (hasTag(toggle, this.allTags)) {
      this.updateTags(this.allTags.filter(t => !expandedTagsInclude(t, toggle)));
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.removeConfigArray$('editors', toggle).subscribe();
      }
    } else if (toggle !== 'locked' || confirm($localize`Locking is permanent once saved. Are you sure you want to lock?`)) {
      this.updateTags([...this.allTags, toggle]);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.addConfigArray$('editors', toggle).subscribe();
      }
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    if (this.focused !== false) this.editor()?.nativeElement.focus();
  }

  setResponse(tag: string) {
    const tags = this.tags()?.value || this.createdTags;
    if (!hasTag(tag, tags)) {
      const responses = this.responseButtons.map(p => p.tag);
      this.toggleIndex = responses.indexOf(tag);
      this.updateTags([...without(tags, ...responses), tag]);
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    if (this.focused !== false) this.editor()?.nativeElement.focus();
  }

  focusText() {
    this.focused = true;
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = 0;
    }
  }

  blurText(value: string) {
    if (this.focused) {
      this.focused = undefined;
      this.blurTimeout = delay(() => {
        if (this.focused === undefined) this.focused = false;
        this.blurTimeout = 0;
      }, 400);
    }
    this.setText(value);
  }

  setText = debounce((value: string) => {
    if (this._text === value) return;
    this._text = value;
    this.store.local.saveEditing(value);
  }, 400, { leading: true, trailing: true, maxWait: 3000 });

  syncText(value: string) {
    if (!value) {
      // Do not throttle
      this._text = value;
      this.store.local.saveEditing(value);
      this.syncEditor.emit(this._text);
    }
    // Clear previous throttled values
    this.syncTextThrottled(value);
    this.control.setValue(value);
  }

  syncTextThrottled = debounce((value: string) => {
    if (this._text === value) return;
    this._text = value;
    this.syncEditor.emit(this._text);
  }, 400);

  togglePreview() {
    if (this.fullscreen) {
      this.store.local.showFullscreenPreview = this.preview = !this.preview;
    } else {
      this.store.local.showPreview = this.preview = !this.preview;
    }
    if (this.focused !== false) this.editor()?.nativeElement.focus();
  }

  toggleStacked() {
    if (this.stacked) {
      if (this.preview) {
        this.store.local.showFullscreenPreview = this.preview = false;
      } else {
        this.store.local.showFullscreenPreview = this.preview = true;
        this.store.local.editorStacked = this.stacked = false;
      }
    } else {
      this.store.local.editorStacked = this.stacked = true;
    }
    if (this.focused !== false) this.editor()?.nativeElement.focus();
  }

  toggleFullscreen(override?: boolean) {
    const editor = this.editor();
    if (!editor) return;
    if (override === this.fullscreen) return;
    this.initialFullscreen = true;
    this.fullscreen = override !== undefined ? override : !this.fullscreen;
    this.focused ||= this.focused === undefined || this.fullscreen;
    if (this.fullscreen) {
      document.documentElement.style.overflowY = 'auto';
      this._text = this.currentText;
      this.stacked = this.store.local.editorStacked;
      this.preview = this.store.local.showFullscreenPreview;
      this.scrollTop = editor.nativeElement.scrollTop;
      let height = 'calc(100vh - 4px)';
      if (window.visualViewport?.height) {
        height = (window.visualViewport.height - 4) + 'px';
        document.body.style.height = height;
        this.el.nativeElement.style.setProperty('--viewport-height', height);
      }
      document.body.classList.add('fullscreen');
      this.overlayRef = this.overlay.create({
        height,
        width: '100vw',
        positionStrategy: this.overlay.position()
          .global()
          .centerHorizontally()
          .top('0'),
        hasBackdrop: true,
        scrollStrategy: this.overlay.scrollStrategies.block(),
      });
      this.overlayRef.attach(new DomPortal(this.el));
      this.overlayRef.backdropClick().subscribe(() => this.toggleFullscreen(false));
      this.overlayRef.keydownEvents().subscribe(event => event.key === 'Escape' && this.toggleFullscreen(false));
      editor.nativeElement.scrollIntoView({ block: 'end' });
      editor.nativeElement.focus();
      editor.nativeElement.setSelectionRange(this.selectionStart, this.selectionEnd);
      editor.nativeElement.scrollTop = this.scrollTopFullscreen;
    } else {
      document.documentElement.style.overflowY = 'scroll';
      this.stacked = true;
      this.preview = this.store.local.showPreview;
      this.scrollTopFullscreen = editor.nativeElement.scrollTop;
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
      delete this.overlayRef;
      document.body.style.height = '';
      this.el.nativeElement.style.setProperty('--viewport-height', this.store.viewportHeight + 'px');
      document.body.classList.remove('fullscreen');
      editor.nativeElement.scrollIntoView({ block: 'center', inline: 'center' });
      if (this.focused) {
        editor.nativeElement.focus();
        editor.nativeElement.setSelectionRange(this.selectionStart, this.selectionEnd);
        editor.nativeElement.scrollTop = this.scrollTop;
      }
    }
  }

  toggleHelp(override?: boolean) {
    this.help = override !== undefined ? override : !this.help;
    if (this.help) {
      const positionStrategy = this.overlay.position()
        .flexibleConnectedTo(this.helpButton()!)
        .withPositions([{
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
        }]);
      this.helpRef = this.overlay.create({
        hasBackdrop: true,
        backdropClass: 'hide',
        positionStrategy,
        scrollStrategy: this.overlay.scrollStrategies.close()
      });
      this.helpRef.attach(new TemplatePortal(this.helpTemplate(), this.vc));
      this.helpRef.backdropClick().subscribe(() => this.toggleHelp(false));
    } else {
      this.helpRef?.detach();
      this.helpRef?.dispose();
    }
  }

  private visible(button: EditorButton) {
    if (button.scheme && button.scheme !== this.scheme) return false;
    if (button.toggle && !this.auth.canAddTag(button.toggle)) return false;
    if (button.global) return true;
    return test(button.query || button._parent!.tag, this.allTags);
  }

  fireEvent(button: EditorButton) {
    const event = button.event!;
    if (button.eventDone) this.loadingEvents[button.eventDone] = true;
    if (event === 'html-to-markdown') {
      this.europa ||= new Europa({
        absolute: !!this.url(),
        baseUri: this.url(),
        inline: true,
      });
      const md = this.europa.convert(this.editor()!.nativeElement.value);
      this.syncText(md);
    } else if (event === 'scrape') {
      // TODO: The 'emit' function requires a mandatory void argument
      this.scrape.emit();
    } else if (event === 'attach') {
      this.fileUpload().nativeElement.click();
    } else {
      this.store.eventBus.fire(event);
    }
    if (this.focused !== false) this.editor()?.nativeElement.focus();
  }

  addComment() {
    this.editing = true;
    defer(() => this.editor()?.nativeElement?.focus());
  }

  private setButtonOn(b: EditorButton) {
    b._on = !!b.toggle && hasTag(b.toggle, this.allTags);
    return b;
  }

  drop(event: Event, items?: DataTransferItemList) {
    this.dropping = false;
    if (!this.admin.getPlugin('plugin/file')) return;
    if (!items) return;
    const files = [] as any;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind == 'file') {
        files.push(d.getAsFile());
      }
    }
    if (!files.length) return;
    event.preventDefault();
    event.stopPropagation();
    this.upload(files);
  }

  upload(files?: FileList | null) {
    if (!files) return;
    const hasActiveUploads = this.uploads.some(upload => !upload.completed && !upload.error);
    if (!hasActiveUploads) {
      // Only clear uploads if no active uploads exist
      this.uploads = [];
    }
    this.control.disable();
    const fileArray = Array.from(files);
    const fileUploads: EditorUpload[] = fileArray.map(file => ({
      id: uuid(),
      name: file.name,
      progress: 0
    }));
    this.uploads = [...this.uploads, ...fileUploads];
    fileArray.map((file, index) => {
      const upload = fileUploads[index];
      return upload.subscription = this.upload$(file, upload).subscribe(ref => {
        if (ref && !ref.url.startsWith('data:')) {
          upload.completed = true;
          upload.progress = 100;
          upload.ref = ref;
          // Emit upload completion so parent can tag it
          this.uploadCompleted.emit(ref);
        }
        this.checkAllUploadsComplete();
      });
    });
  }

  upload$(file: File, upload: EditorUpload): Observable<Ref | null> {
    const codeType = mimeToCode(file.type);
    if (codeType.length) {
      const ref = {
        origin: this.store.account.origin,
        url: 'internal:' + uuid(),
        title: file.name,
        // Upload as private - only localTag and internal, no visibility tags
        tags: uniq([
          this.store.account.localTag,
          'internal',
          ...file.type === 'text/markdown' ? [] : codeType
        ])
      };
      upload.progress = 50; // Simulate progress for text files
      return readFileAsString(file).pipe(
        switchMap(contents => this.refs.create({
          ...ref,
          comment: contents,
        })),
        map(cursor => ref),
        tap(() => upload.progress = 100),
        catchError(err => {
          upload.error = err.message || 'Upload failed';
          upload.progress = 0;
          return readFileAsDataURL(file).pipe(map(url => ({ ...ref, url }))); // base64
        }),
      );
    } else {
      // Upload binary files as private - only plugin/file and type-specific tags
      const tags: string[] = ['plugin/file'];
      if (file.type.startsWith('audio/') && this.admin.getPlugin('plugin/audio')) {
        tags.push('plugin/audio');
      } else if (file.type.startsWith('video/') && this.admin.getPlugin('plugin/video')) {
        tags.push('plugin/video', 'plugin/thumbnail');
      } else if (file.type.startsWith('image/') && this.admin.getPlugin('plugin/image')) {
        tags.push('plugin/image', 'plugin/thumbnail');
      } else if (file.type.startsWith('application/pdf') && this.admin.getPlugin('plugin/pdf')) {
        tags.push('plugin/pdf');
      }
      return this.proxy.save(file, this.store.account.origin).pipe(
        map(event => {
          switch (event.type) {
            case HttpEventType.Response:
              return event.body;
            case HttpEventType.UploadProgress:
              const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
              this.progress = percentDone;
              upload.progress = percentDone;
              return null;
          }
          return null;
        }),
        last(),
        switchMap(ref => !ref ? of(ref) : this.ts.patch(tags, ref.url, ref.origin).pipe(
          map(cursor => ({ ...ref, tags: uniq([...ref?.tags || [], ...tags]) })),
        )),
        catchError(err => {
          upload.error = err.message || 'Upload failed';
          upload.progress = 0;
          return readFileAsDataURL(file).pipe(map(url => ({url, tags}))); // base64
        }),
      );
    }
  }

  attachUrls(...refs: (Ref | null)[]) {
    refs = refs.filter(u => !!u);
    if (!refs.length) return;
    for (const ref of refs) this.addSource.emit(ref!.url);
    const text = this.currentText;
    const embed = (ref: Ref) => hasTag('plugin/audio', ref) || hasTag('plugin/video', ref) || hasTag('plugin/image', ref) || hasTag('plugin/pdf', ref);
    if (refs.length === 1) {
      if (!refs[0]) return;
      const encodedUrl = (this.selectionStart !== this.selectionEnd ? '[' + text.substring(this.selectionStart, this.selectionEnd) + ']'
          : embed(refs[0]) ? '![]' : '![=]'
      ) + '(' + refs[0].url.replace(')', '\\)') + ')\n';
      if (this.selectionStart || this.selectionStart !== this.selectionEnd) {
        this.syncText(text.substring(0, this.selectionStart) + encodedUrl + text.substring(this.selectionEnd));
      } else {
        this.syncText(text + encodedUrl + '\n');
      }
    } else {
      const encodedUrls = refs.map(ref => (embed(ref!) ? '![]' : '![=]') + '(' + ref!.url.replace(')', '\\)') + ')\n').join('');
      this.syncText(text.substring(0, this.selectionStart) + encodedUrls + text.substring(this.selectionStart));
      if (!text) this.preview = true;
    }
    if (!text) this.preview = true;
    if (this.focused !== false) this.editor()?.nativeElement.focus();
  }

  checkAllUploadsComplete() {
    const allComplete = this.uploads.every(upload => upload.completed || upload.error);
    if (allComplete && this.uploads.length > 0) {
      this.control.enable();
      const completedRefs = this.uploads
        .filter(upload => upload.completed && upload.ref)
        .map(upload => upload.ref!);
      if (completedRefs.length > 0) {
        this.attachUrls(...completedRefs);
      }
      this.uploads = [];
    }
  }

  cancelUpload(upload: EditorUpload) {
    if (upload.subscription) {
      upload.subscription.unsubscribe();
    }
    this.uploads = this.uploads.filter(u => u.id !== upload.id);
    if (this.uploads.length === 0) {
      this.control.enable();
    } else {
      this.checkAllUploadsComplete();
    }
  }

  cancelAllUploads() {
    this.uploads.forEach(upload => {
      if (upload.subscription) {
        upload.subscription.unsubscribe();
      }
    });
    this.uploads = [];
    this.control.enable();
  }

  dragLeave(parent: HTMLElement, target: HTMLElement) {
    if (this.dropping && parent === target || !parent.contains(target)) {
      this.dropping = false;
    }
  }

  hasActiveUploads(): boolean {
    return this.uploads.some(upload => !upload.completed && !upload.error);
  }

}
