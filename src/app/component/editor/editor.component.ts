import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import { Component, ElementRef, EventEmitter, HostBinding, Input, Output, TemplateRef, ViewChild, ViewContainerRef } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { debounce, throttle, uniq, without } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent {
  @HostBinding('class') css = 'editor';

  id = uuid();

  @HostBinding('class.stacked')
  stacked = true;
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @HostBinding('class.help')
  help = false;
  @HostBinding('class.preview')
  preview = true;
  @HostBinding('style.padding.px')
  padding = 8;

  @ViewChild('editor')
  editor?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  @Input()
  tags?: string[];
  @Input()
  control!: UntypedFormControl;
  @Input()
  autoFocus = false
  @Input()
  showScrape = false
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

  private _text? = '';
  private _editing = false;

  constructor(
    private admin: AdminService,
    private accounts: AccountService,
    private auth: AuthzService,
    public store: Store,
    private overlay: Overlay,
    private el: ElementRef,
    private vc: ViewContainerRef,
  ) {
    this.preview = store.local.showPreview;
  }

  get fullTags() {
    const tags = this.store.account.defaultEditors(this.editors);
    if (!this.tags?.length) return tags;
    return uniq([...tags, ...this.editors.filter(t => this.tags!.includes(t))]);
  }

  get editing(): boolean {
    return this._editing;
  }

  @HostBinding('class.editing')
  set editing(value: boolean) {
    if (!this._editing && value) {
      this._editing = value;
      this.preview = this.store.local.showPreview;
      this.tags = this.fullTags;
    }
  }

  get editors() {
    return this.editorPlugins.map(p => p.tag);
  }

  get editorPlugins() {
    return this.admin.editors.filter(e => this.auth.canAddTag(e.tag));
  }

  get currentText() {
    return this._text || this.control?.value || '';
  }

  toggleTag(tag: string) {
    if (this.tags?.includes(tag)) {
      this.syncTags.next(this.tags = without(this.tags!, tag));
    } else {
      this.syncTags.next(this.tags = [...this.tags || [], tag]);
    }
    if (this.admin.getTemplate('user')) {
      this.accounts.updateConfig('editors', this.tags).subscribe();
    }
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
      this.syncEditor.next(this._text);
    }
    // Clear previous throttled values
    this.syncTextThrottled(value);
  }

  syncTextThrottled = debounce((value: string) => {
    this._text = value;
    this.syncEditor.next(this._text);
  }, 400);

  toggleStacked() {
    if (this.fullscreen) {
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
    } else {
      this.store.local.showPreview = this.preview = !this.preview;
    }
  }

  toggleFullscreen(override?: boolean) {
    if (override === this.fullscreen) return;
    this.fullscreen = override !== undefined ? override : !this.fullscreen;
    if (this.fullscreen) {
      this._text = this.currentText;
      this.stacked = this.store.local.editorStacked;
      this.preview = this.store.local.showFullscreenPreview;
      this.overlayRef = this.overlay.create({
        height: '100vh',
        width: '100vw',
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        hasBackdrop: true,
        scrollStrategy: this.overlay.scrollStrategies.block(),
      });
      this.overlayRef.attach(new DomPortal(this.el));
      this.overlayRef.backdropClick().subscribe(() => this.toggleFullscreen(false));
      this.overlayRef.keydownEvents().subscribe(event => event.key === "Escape" && this.toggleFullscreen(false));
      this.editor?.nativeElement.focus();
    } else {
      this.stacked = true;
      this.preview = this.store.local.showPreview;
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
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
}
