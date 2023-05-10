import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding, HostListener,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { debounce, defer, throttle, uniq, without } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import * as XLSX from 'xlsx';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { Store } from '../../store/store';

declare const canvasDatagrid: any;

@Component({
  selector: 'app-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements AfterViewInit {
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

  @ViewChild('tw')
  tw?: ElementRef<HTMLDivElement>;
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

  @HostBinding('style.padding.px')
  padding = 8;

  grid: any;

  private _tags?: string[];
  private _text? = '';
  private _editing = false;

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

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (this.fullscreen) {
      this.resizeGrid();
    }
  }

  @ViewChild('spreadsheet')
  set spreadsheet(div: ElementRef) {
    if (!div) {
      if (this.grid) this.grid.dispose();
      return;
    }
    const wb = XLSX.read(this.currentText, {type: 'string'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    this.grid = canvasDatagrid({
      parentNode: div.nativeElement,
      data,
    });
    this.grid.addEventListener('endedit', () => this.syncGrid());
    this.grid.addEventListener('reordering', () => this.syncGrid());
  }

  @Input()
  set tags(value: string[] | undefined) {
    this._tags = value;
  }

  get tags() {
    return this._tags;
  }

  get sheet() {
    return this.admin.status.plugins.sheet && this.tags?.includes('plugin/sheet');
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

  syncGrid() {
    function prep(arr: any[]) {
      const out = [];
      for (let i = 0; i < arr.length; ++i) {
        if (!arr[i]) continue;
        if (Array.isArray(arr[i])) {
          out[i] = arr[i];
          continue;
        }
        const o: any[] = [];
        Object.keys(arr[i]).forEach((k) => o[+k] = arr[i][k] );
        out[i] = o;
      }
      return out;
    }
    // @ts-ignore
    this.syncText(XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet(prep(this.grid.data))), {
      blankrows: false,
      strip: true,
    });
  }

  toggleTag(tag: string) {
    if (this.tags?.includes(tag)) {
      this.syncTags.next(this._tags = without(this.tags!, tag));
    } else {
      this.syncTags.next(this._tags = [...this.tags || [], tag]);
    }
    if (this.admin.status.templates.user) {
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
    this.resizeGrid();
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
      this.resizeGrid();
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

  resizeGrid() {
    defer(() => {
      this.grid.style.width = this.tw?.nativeElement.offsetWidth + 'px';
      this.grid.style.height = this.tw?.nativeElement.offsetHeight + 'px';
    });
  }
}
