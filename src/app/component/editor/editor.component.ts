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
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { debounce, throttle, uniq, without } from 'lodash-es';
import { runInAction } from 'mobx';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';
import { relativeX, relativeY } from '../../util/math';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements AfterViewInit {
  @HostBinding('class') css = 'editor';

  @HostBinding('class.stacked')
  stacked = true;
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @HostBinding('class.help')
  help = false;
  @HostBinding('class.preview')
  preview = true;

  @ViewChild('editor')
  editor?: ElementRef<HTMLTextAreaElement>;

  @Input()
  control!: UntypedFormControl;
  @Input()
  autoFocus = false
  @Input()
  fillWidth?: HTMLElement;

  @Output()
  syncEditor = new EventEmitter<string>();
  @Output()
  syncTags = new EventEmitter<string[]>();

  overlayRef?: OverlayRef;
  helpRef?: OverlayRef;

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  mouseLeft = false;

  private _tags?: string[];
  private _text? = '';

  constructor(
    private admin: AdminService,
    private accounts: AccountService,
    private auth: AuthzService,
    public store: Store,
    private overlay: Overlay,
    private exts: ExtService,
    private el: ElementRef,
    private vc: ViewContainerRef,
  ) {
    this.preview = store.local.showPreview;
  }

  ngAfterViewInit() {
    this.tags = this._tags;
  }

  @Input()
  set tags(value: string[] | undefined) {
    this._tags = this.store.account.defaultEditors(this.editors);
    if (value && value.length) {
      this._tags = uniq([...this._tags, ...this.editors.filter(t => value.includes(t))]);
    }
    this.syncTags.next(this._tags);
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent) {
    const y = relativeY(event.clientY, this.editor?.nativeElement);
    if (y < 0 || y > this.editor!.nativeElement.offsetHeight) return;
    this.mouseLeft = relativeX(event.clientX, this.editor?.nativeElement) < this.editor!.nativeElement.offsetWidth / 2;
  }

  get tags() {
    return this._tags;
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
      this.syncTags.next(this._tags = without(this.tags!, tag));
    } else {
      this.syncTags.next(this._tags = [...this.tags || [], tag]);
    }
    if (this.admin.status.templates.user) {
      runInAction(() => {
        this.accounts.updateConfig('editor', this.tags);
      });
    }
  }

  setText = throttle((value: string) => {
    if (this._text === value) return;
    this._text = value;
    this.store.local.saveEditing(value);
  }, 400);

  syncText = debounce((value: string) => {
    this._text = value;
    this.syncEditor.next(this._text)
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
