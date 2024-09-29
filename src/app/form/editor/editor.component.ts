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
import { UntypedFormControl } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import Europa from 'europa';
import { debounce, defer, delay, throttle, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { filter } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { EditorButton, sortOrder } from '../../model/tag';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnChanges, AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'editor';

  private disposers: IReactionDisposer[] = [];

  id = uuid();

  @HostBinding('class.stacked')
  stacked = true;
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @HostBinding('class.help')
  help = false;
  @HostBinding('class.preview')
  preview = this.store.local.showPreview;

  @ViewChild('editor')
  editor?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  @Input()
  selectResponseType = false;
  @Input()
  fullscreenDefault?: boolean;
  @Input()
  tags?: string[];
  @Input()
  control!: UntypedFormControl;
  @Input()
  autoFocus = false;
  @Input()
  url = '';
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
  toggleResponse: string[] = [];
  addEditorTags: string[] = [];
  removeEditorTags: string[] = [];
  initialFullscreen = false;
  focused?: boolean = false;

  private _text? = '';
  private _editing = false;
  private _padding = 8;

  private europa?: Europa;
  private selectionStart = 0;
  private selectionEnd = 0;
  private blurTimeout = 0;

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
    this.addEditorTags = this.store.account.defaultEditors(this.editors);
    if (this.selectResponseType && this.responseButtons.length) {
      this.toggleResponse = this.responseButtons[0].config?.reply || [this.responseButtons[0].tag];
      this.toggleIndex = 0;
      for (const p of this.responseButtons) {
        if (this.tags?.includes(p.tag)) {
          this.toggleResponse = p.config?.reply || [p.tag];
          this.toggleIndex = this.responseButtons.indexOf(p);
        }
      }
    }
    if (this.editing) {
      this.syncTags.next(this.addTags);
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
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.tags || changes.url) {
      this.init();
    }
  }

  ngOnDestroy() {
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

  onSelect() {
    defer(() => {
      this.selectionStart = this.editor?.nativeElement.selectionStart || 0;
      this.selectionEnd = this.editor?.nativeElement.selectionEnd || 0;
    });
  }

  @HostBinding('style.padding.px')
  get padding(): number {
    if (this.fullscreen) return 0;
    return this._padding + 8;
  }

  set padding(value: number) {
    this._padding = value;
  }

  get addTags() {
    return without(uniq([
      ...this.toggleResponse,
      ...this.addEditorTags,
    ]), ...this.removeEditorTags.map(t => '-' + t));
  }

  get fullTags() {
    return without(uniq([
      ...this.tags || [],
      ...this.toggleResponse,
      ...this.addEditorTags,
    ]), ...this.removeEditorTags);
  }

  get editing(): boolean {
    return this._editing;
  }

  @HostBinding('class.editing')
  set editing(value: boolean) {
    if (!this._editing && value) {
      this.syncTags.emit(this.addTags);
      defer(() => {
        this._editing = true;
        if (this.fullscreenDefault && !this.initialFullscreen) {
          this.toggleFullscreen(true);
        }
      });
    }
  }

  @memo
  get editors() {
    return this.editorButtons.map(p => p?.toggle as string).filter(p => !!p);
  }

  @memo
  get editorButtons() {
    return sortOrder(this.admin.getEditorButtons(this.tags, this.scheme)).reverse();
  }

  @memo
  get responseButtons() {
    return this.admin.responseButton;
  }

  @memo
  get editorRibbons() {
    return this.editorButtons.filter(b => b.ribbon && this.visible(b));
  }

  @memo
  get editorPushButtons() {
    return this.editorButtons.filter(b => !b.ribbon && this.visible(b));
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

  toggleTag(button: EditorButton) {
    if (button.event) this.fireEvent(button.event);
    const tag = button.toggle!;
    MemoCache.clear(this);
    if (this.buttonOn(tag)) {
      if (this.addEditorTags.includes(tag)) this.addEditorTags.splice(this.addEditorTags.indexOf(tag), 1);
      this.removeEditorTags.push(tag);
      this.syncTags.next(this.addTags);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.removeConfigArray$('editors', tag).subscribe();
      }
    } else if (tag !== 'locked' || window.confirm($localize`Locking is permanent once saved. Are you sure you want to lock?`)) {
      if (this.removeEditorTags.includes(tag)) this.removeEditorTags.splice(this.removeEditorTags.indexOf(tag), 1);
      this.addEditorTags.push(tag);
      this.syncTags.next(this.addTags);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.addConfigArray$('editors', tag).subscribe();
      }
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    this.editor?.nativeElement.focus();
  }

  buttonOn(tag: string) {
    return (this.tags?.includes(tag) || this.addEditorTags.includes(tag)) && !this.removeEditorTags.includes(tag);
  }

  setResponse(tag: string) {
    if (!this.tags?.includes(tag)) {
      this.toggleIndex = this.responseButtons.map(p => p.tag).indexOf(tag);
      const button = this.responseButtons[this.toggleIndex];
      this.toggleResponse = button?.config?.reply || [button.tag];
      this.syncTags.next(this.addTags);
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    this.editor?.nativeElement.focus();
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
    this.editor?.nativeElement.focus();
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
    this.editor?.nativeElement.focus();
  }

  toggleFullscreen(override?: boolean) {
    if (!this.editor) return;
    if (override === this.fullscreen) return;
    this.initialFullscreen = true;
    this.fullscreen = override !== undefined ? override : !this.fullscreen;
    this.focused ||= this.focused === undefined || this.fullscreen;
    if (this.fullscreen) {
      this._text = this.currentText;
      this.stacked = this.store.local.editorStacked;
      this.preview = this.store.local.showFullscreenPreview;
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
      this.editor.nativeElement.focus();
      this.editor.nativeElement.scrollIntoView({ block: 'end' });
    } else {
      this.stacked = true;
      this.preview = this.store.local.showPreview;
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
      delete this.overlayRef;
      document.body.style.height = '';
      this.el.nativeElement.style.setProperty('--viewport-height', this.store.viewportHeight + 'px');
      document.body.classList.remove('fullscreen');
      if (this.focused) {
        this.editor.nativeElement.focus();
        this.editor.nativeElement.scrollIntoView({ block: 'center', inline: 'center' });
      }
    }
    if (this.focused && override === undefined) this.editor?.nativeElement.setSelectionRange(this.selectionStart, this.selectionEnd);
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

  visible(button: EditorButton) {
    if (button.scheme && button.scheme !== this.scheme) return false;
    if (button.toggle && !this.auth.canAddTag(button.toggle)) return false;
    if (button.global) return true;
    return this.tags?.includes(button._parent!.tag);
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
    this.editor?.nativeElement.focus();
  }
}
