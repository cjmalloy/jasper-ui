import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { UntypedFormArray, UntypedFormControl } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import Europa from 'europa';
import { debounce, defer, delay, sortedLastIndex, throttle, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { filter, Subject, takeUntil } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { MdComponent } from '../../component/md/md.component';
import { EditorButton, sortOrder } from '../../model/tag';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';

@Component({
  standalone: false,
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss'],
  host: {'class': 'editor'}
})
export class EditorComponent implements OnChanges, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

  id = uuid();

  @HostBinding('class.stacked')
  stacked = true;
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @HostBinding('class.help')
  help = false;
  @HostBinding('class.md-preview')
  preview = this.store.local.showPreview;

  @ViewChild('editor')
  editor?: ElementRef<HTMLTextAreaElement>;
  @ViewChild(MdComponent)
  md?: MdComponent;
  @ViewChild('hiddenMeasure')
  hiddenMeasure?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  @Input()
  hasTags = true;
  @Input()
  selectResponseType = false;
  @Input()
  tags?: UntypedFormArray;
  @Input()
  createdTags: string[] = [];
  @Input()
  control!: UntypedFormControl;
  @Input()
  autoFocus = false;
  @Input()
  addButton = false;
  @Input()
  url = '';
  @Input()
  addCommentTitle = $localize`Add comment`;
  @Input()
  addCommentLabel = $localize`+ Add comment`;
  @Input()
  fillWidth?: HTMLElement;

  @Output()
  syncEditor = new EventEmitter<string>();
  @Output()
  syncTags = new EventEmitter<string[]>();
  @Output()
  scrape = new EventEmitter<void>();

  overlayRef?: OverlayRef;
  helpRef?: OverlayRef;
  toggleIndex = 0;
  initialFullscreen = false;
  focused?: boolean = false;

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

  constructor(
    public admin: AdminService,
    private accounts: AccountService,
    private auth: AuthzService,
    public store: Store,
    private overlay: Overlay,
    private router: Router,
    private el: ElementRef,
    private vc: ViewContainerRef,
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.toggleFullscreen(false));
  }

  init() {
    MemoCache.clear(this);
    if (this.selectResponseType && this.responseButtons.length) {
      this.toggleIndex = 0;
      const tags = this.tags?.value || this.createdTags;
      for (const p of this.responseButtons) {
        if (tags.includes(p.tag)) {
          this.toggleIndex = this.responseButtons.indexOf(p);
        }
      }
    }
  }

  ngAfterViewInit(): void {
    this.disposers.push(autorun(() => {
      const height = this.store.viewportHeight - 4;
      if (this.overlayRef) {
        this.overlayRef.updateSize({ height });
        document.body.style.height = height + 'px';
        this.el.nativeElement.style.setProperty('--viewport-height', height + 'px');
      }
    }));
    if (this.tags) {
      this.tags.valueChanges.pipe(
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
    if (changes.tags || changes.url) {
      this.init();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    document.body.style.height = '';
    document.body.classList.remove('fullscreen');
    this.el.nativeElement.style.setProperty('--viewport-height', this.store.viewportHeight + 'px');
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
      this.selectionStart = this.editor?.nativeElement.selectionStart || 0;
      this.selectionEnd = this.editor?.nativeElement.selectionEnd || 0;
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
    if (!this.preview || !this.fullscreen || !this.md) return;
    const start = this.sourceMap[Math.max(sortedLastIndex(this.sourceMap, this.selectionStart) - 1, 0)];
    this.md.el.nativeElement.scrollTop = (this.scrollMap.get(start) ?? 0) - this.md.el.nativeElement.clientHeight / 2;
  }

  onSelectPreview() {
    if (!this.preview || !this.fullscreen || !this.hiddenMeasure || !this.editor) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (!this.md?.el.nativeElement?.contains(sel.anchorNode)) return;
    const anchorEl = (sel.anchorNode as Node).nodeType === Node.ELEMENT_NODE
      ? sel.anchorNode as HTMLElement
      : (sel.anchorNode as Node).parentElement;
    const sourceMap = anchorEl!.closest('[aria-posinset]');
    if (!sourceMap) return;
    const start = +sourceMap.getAttribute('aria-posinset')!;
    this.hiddenMeasure.nativeElement.style.width = this.editor.nativeElement.clientWidth + 'px';
    this.hiddenMeasure.nativeElement.value = this.currentText.slice(0, start);
    this.editor.nativeElement.scrollTop = this.hiddenMeasure.nativeElement.scrollHeight - this.editor.nativeElement.clientHeight / 2;
  }

  @HostBinding('class.add-button')
  get addButtonClass() {
    return this.addButton && !this.editing && !this.currentText;
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
    return uniq([
      ...without(this.tags ? this.tags.value : this.createdTags, ...this.allResponseTags),
      ...this.responseTags,
    ]);
  }

  @memo
  get initTags() {
    return [
      ...without(this.store.account.defaultEditors(this.editors), ...this.allTags),
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
    return this.editorButtons.filter(b => b.ribbon && this.visible(b)).map(b => this.setButtonOn(b));
  }

  @memo
  get editorPushButtons() {
    return this.editorButtons.filter(b => !b.ribbon && this.visible(b)).map(b => this.setButtonOn(b));
  }

  @memo
  get responseTags() {
    if (!this.selectResponseType || !this.responseButtons.length) return [];
    const p = this.responseButtons[this.toggleIndex];
    return p.config?.reply || [p.tag];
  }

  @memo
  get allResponseTags() {
    if (!this.selectResponseType) return [];
    return this.responseButtons.flatMap(p => p.config?.reply || [p.tag]);
  }

  @memo
  get scheme() {
    if (!this.url) return '';
    if (!this.url.includes(':')) return '';
    return this.url.substring(0, this.url.indexOf(':') + 1);
  }

  get currentText() {
    return this._text || this.control?.value || '';
  }

  updateTags(tags: string[]) {
    if (!this.tags) {
      this.createdTags = tags;
      MemoCache.clear(this);
    }
    this.syncTags.next(tags);
  }

  toggleTag(button: EditorButton) {
    if (button.event) this.fireEvent(button.event);
    const tag = button.toggle!;
    if (this.allTags.includes(tag)) {
      this.updateTags(without(this.allTags, tag));
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.removeConfigArray$('editors', tag).subscribe();
      }
    } else if (tag !== 'locked' || confirm($localize`Locking is permanent once saved. Are you sure you want to lock?`)) {
      this.updateTags([...this.allTags, tag]);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.addConfigArray$('editors', tag).subscribe();
      }
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    if (this.focused !== false) this.editor?.nativeElement.focus();
  }

  setResponse(tag: string) {
    const tags = this.tags?.value || this.createdTags;
    if (!tags.includes(tag)) {
      const responses = this.responseButtons.map(p => p.tag);
      this.toggleIndex = responses.indexOf(tag);
      this.updateTags([...without(tags, ...responses), tag]);
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    if (this.focused !== false) this.editor?.nativeElement.focus();
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

  setText = throttle((value: string) => {
    if (this._text === value) return;
    this._text = value;
    this.store.local.saveEditing(value);
  }, 400);

  syncText(value: string) {
    if (!value) {
      // Do not throttle
      this._text = value;
      this.store.local.saveEditing(value);
      this.syncEditor.next(this._text);
    }
    // Clear previous throttled values
    this.syncTextThrottled(value);
  }

  syncTextThrottled = debounce((value: string) => {
    if (this._text === value) return;
    this._text = value;
    this.syncEditor.next(this._text);
  }, 400);

  togglePreview() {
    if (this.fullscreen) {
      this.store.local.showFullscreenPreview = this.preview = !this.preview;
    } else {
      this.store.local.showPreview = this.preview = !this.preview;
    }
    if (this.focused !== false) this.editor?.nativeElement.focus();
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
    if (this.focused !== false) this.editor?.nativeElement.focus();
  }

  toggleFullscreen(override?: boolean) {
    if (!this.editor) return;
    if (override === this.fullscreen) return;
    this.initialFullscreen = true;
    this.fullscreen = override !== undefined ? override : !this.fullscreen;
    this.focused ||= this.focused === undefined || this.fullscreen;
    if (this.fullscreen) {
      document.documentElement.style.overflowY = 'auto';
      this._text = this.currentText;
      this.stacked = this.store.local.editorStacked;
      this.preview = this.store.local.showFullscreenPreview;
      this.scrollTop = this.editor.nativeElement.scrollTop;
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
      this.editor.nativeElement.scrollIntoView({ block: 'end' });
      this.editor.nativeElement.focus();
      this.editor.nativeElement.setSelectionRange(this.selectionStart, this.selectionEnd);
      this.editor.nativeElement.scrollTop = this.scrollTopFullscreen;
    } else {
      document.documentElement.style.overflowY = 'scroll';
      this.stacked = true;
      this.preview = this.store.local.showPreview;
      this.scrollTopFullscreen = this.editor.nativeElement.scrollTop;
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
      delete this.overlayRef;
      document.body.style.height = '';
      this.el.nativeElement.style.setProperty('--viewport-height', this.store.viewportHeight + 'px');
      document.body.classList.remove('fullscreen');
      this.editor.nativeElement.scrollIntoView({ block: 'center', inline: 'center' });
      if (this.focused) {
        this.editor.nativeElement.focus();
        this.editor.nativeElement.setSelectionRange(this.selectionStart, this.selectionEnd);
        this.editor.nativeElement.scrollTop = this.scrollTop;
      }
    }
  }

  toggleHelp(override?: boolean) {
    this.help = override !== undefined ? override : !this.help;
    if (this.help) {
      this.helpRef = this.overlay.create({
        height: '100vh',
        width: '100vw',
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        hasBackdrop: true,
        scrollStrategy: this.overlay.scrollStrategies.block(),
      });
      this.helpRef.attach(new TemplatePortal(this.helpTemplate, this.vc));
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
    return this.allTags.includes(button._parent!.tag);
  }

  fireEvent(event: string) {
    if (event === 'html-to-markdown') {
      this.europa ||= new Europa({
        absolute: !!this.url,
        baseUri: this.url,
        inline: true,
      });
      const md = this.europa.convert(this.editor!.nativeElement.value);
      this.control.setValue(md);
      this.syncText(md);
    } else if (event === 'scrape') {
      this.scrape.emit();
    } {
      this.store.eventBus.fire(event);
    }
    if (this.focused !== false) this.editor?.nativeElement.focus();
  }

  addComment() {
    this.editing = true;
    defer(() => this.editor?.nativeElement?.focus());
  }

  private setButtonOn(b: EditorButton) {
    b._on = !!b.toggle && this.allTags.includes(b.toggle);
    return b;
  }
}
