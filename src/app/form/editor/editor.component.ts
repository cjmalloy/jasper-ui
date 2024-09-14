import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
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
import { debounce, defer, throttle, uniq, without } from 'lodash-es';
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
  preview = false;

  @ViewChild('editor')
  editor?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  @Input()
  selectResponseType = false;
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
  toggleResponse = 0;

  private _text? = '';
  private _editing = false;
  private _padding = 8;

  private europa?: Europa;

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
    this.preview = store.local.showPreview;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.toggleFullscreen(false));
  }

  init() {
    MemoCache.clear(this);
    for (const p of this.responseButtons) {
      if (this.tags?.includes(p.tag)) this.toggleResponse = this.responseButtons.indexOf(p);
    }
  }

  ngAfterViewInit(): void {
    if (this.editing) {
      this.syncTags.emit(this.tags);
    }
    this.disposers.push(autorun(() => {
      const height = this.store.viewportHeight;
      if (this.overlayRef) {
        this.overlayRef.updateSize({ height });
        document.body.style.height = height + 'px';
      }
    }))
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
  }

  @HostBinding('style.padding.px')
  get padding(): number {
    if (this.fullscreen) return 0;
    return this._padding + 8;
  }

  set padding(value: number) {
    this._padding = value;
  }

  @memo
  get fullTags() {
    const tags = this.store.account.defaultEditors(this.editors);
    if (this.selectResponseType && this.responseButtons.length && !this.responseButtons.filter(p => this.tags?.includes(p.tag)).length) {
      tags.push(this.responseButtons[0].tag);
    }
    if (!this.tags?.length) return tags;
    return uniq([...tags, ...this.editors.filter(t => this.tags!.includes(t))]);
  }

  get editing(): boolean {
    return this._editing;
  }

  @HostBinding('class.editing')
  set editing(value: boolean) {
    if (!this._editing && value) {
      defer(() => {
        this._editing = value;
        this.preview = this.store.local.showPreview;
        this.tags = this.fullTags;
        this.syncTags.emit(this.tags);
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
    if (this.tags?.includes(tag)) {
      this.syncTags.next(this.tags = without(this.tags!, tag));
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.removeConfigArray$('editors', tag).subscribe();
      }
    } else if (tag !== 'locked' || window.confirm($localize`Locking is permanent once saved. Are you sure you want to lock?`)) {
      this.syncTags.next(this.tags = [...this.tags || [], tag]);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.addConfigArray$('editors', tag).subscribe();
      }
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    this.editor?.nativeElement.focus();
  }

  setResponse(tag: string) {
    if (!this.tags?.includes(tag)) {
      this.toggleResponse = this.responseButtons.map(p => p.tag).indexOf(tag);
      this.syncTags.next(this.tags = [...without(this.tags!, ...this.responseButtons.map(p => p.tag)), tag]);
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
    this.editor?.nativeElement.focus();
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
    this.store.local.showPreview = this.preview = !this.preview;
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
    if (override === this.fullscreen) return;
    this.fullscreen = override !== undefined ? override : !this.fullscreen;
    if (this.fullscreen) {
      this._text = this.currentText;
      this.stacked = this.store.local.editorStacked;
      this.preview = this.store.local.showFullscreenPreview;
      if (this.store.viewportHeight) document.body.style.height = this.store.viewportHeight + 'px';
      this.overlayRef = this.overlay.create({
        height: this.store.viewportHeight ? this.store.viewportHeight + 'px' : '100vh',
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
      this.overlayRef.keydownEvents().subscribe(event => event.key === "Escape" && this.toggleFullscreen(false));
      this.editor?.nativeElement.focus();
      defer(() => this.editor?.nativeElement.scrollIntoView(true));
    } else {
      this.stacked = true;
      this.preview = this.store.local.showPreview;
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
      delete this.overlayRef;
      document.body.style.height = '';
    }
    this.editor?.nativeElement.focus();
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
