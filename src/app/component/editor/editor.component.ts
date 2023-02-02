import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  TemplateRef, ViewChild, ViewContainerRef
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { debounce, delay, uniq, without } from 'lodash-es';
import { runInAction } from 'mobx';
import { switchMap } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent {
  @HostBinding('class') css = 'editor';

  @HostBinding('class.stacked')
  stacked = true;
  @HostBinding('class.fullscreen')
  fullscreen = false;
  @HostBinding('class.help')
  help = false;
  @HostBinding('class.preview')
  preview = true;

  @Input()
  control?: UntypedFormControl;
  @Input()
  text? = '';
  @Input()
  autoFocus = false

  @Output()
  syncEditor = new EventEmitter<string>();
  @Output()
  syncTags = new EventEmitter<string[]>();

  overlayRef?: OverlayRef;
  helpRef?: OverlayRef;

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  private _tags?: string[];

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
    public store: Store,
    private overlay: Overlay,
    private exts: ExtService,
    private el: ElementRef,
    private vc: ViewContainerRef,
  ) {
    this.preview = store.local.showPreview;
  }

  @Input()
  set tags(value: string[] | undefined) {
    const editors = this.editorPlugins.map(e => e.tag);
    this._tags = this.store.account.defaultEditors(editors);
    if (value && value.length) {
      this._tags = uniq([...this._tags, ...editors.filter(t => value.includes(t))]);
    }
    this.syncTags.next(this._tags);
  }

  get tags() {
    return this._tags;
  }

  get editorPlugins() {
    return this.admin.editors.filter(e => this.auth.tagReadAccess(e.tag));
  }

  get currentText() {
    return this.text || this.control?.value || '';
  }

  toggleTag(tag: string) {
    if (this.tags!.includes(tag)) {
      this.syncTags.next(this._tags = without(this.tags!, tag));
    } else {
      this.syncTags.next(this._tags = [...this.tags!, tag]);
    }
    if (this.admin.status.templates.user) {
      runInAction(() => {
        this.store.account.ext!.config ||= {};
        this.store.account.ext!.config.editors = this.tags;
        this.exts.update(this.store.account.ext!)
          .pipe(
            switchMap(() => this.exts.get(this.store.account.ext!.tag)),
          ).subscribe(ext => runInAction(() => this.store.account.ext = ext));
      });
    }
  }

  setText = debounce((value: string) => {
    this.text = value;
    this.store.local.saveEditing(value);
  }, 400);

  syncText = debounce((value: string) => {
    this.text = value;
    this.syncEditor.next(this.text)
  }, 400);

  toggleStacked() {
    this.text = this.currentText;
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

  toggleFullscreen() {
    this.text = this.currentText;
    this.fullscreen = !this.fullscreen;
    if (this.fullscreen) {
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
    } else {
      this.stacked = true;
      this.preview = this.store.local.showPreview;
      this.overlayRef?.detach();
      this.overlayRef?.dispose();
    }
  }

  toggleHelp() {
    this.help = !this.help;
    if (this.help) {
      this.helpRef = this.overlay.create({
        height: '100vh',
        width: '100vw',
        positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
        hasBackdrop: true,
        scrollStrategy: this.overlay.scrollStrategies.block(),
      });
      this.helpRef.attach(new TemplatePortal(this.helpTemplate, this.vc));
    } else {
      this.helpRef?.detach();
      this.helpRef?.dispose();
    }
  }
}
