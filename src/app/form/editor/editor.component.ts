import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal, TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { Editor } from '@toast-ui/editor';
import Europa from 'europa';
import { debounce, throttle, uniq, without } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
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
export class EditorComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'editor';
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

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

  @ViewChild('help')
  helpTemplate!: TemplateRef<any>;

  @Input()
  tags?: string[];
  @Input()
  control!: UntypedFormControl;
  @Input()
  autoFocus = false;
  @Input()
  showScrape = false;
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
  editorInstance?: Editor;

  private _text? = '';
  private _editing = false;

  private europa?: Europa;
  private _editor?: ElementRef<HTMLTextAreaElement>;

  constructor(
    public admin: AdminService,
    private accounts: AccountService,
    private auth: AuthzService,
    public store: Store,
    private overlay: Overlay,
    private el: ElementRef,
    private vc: ViewContainerRef,
  ) {
    this.preview = store.local.showPreview;
  }

  ngAfterViewInit() {
    this.disposers.push(autorun(() => {
      if (this.editorInstance) {
        if (this.store.darkTheme) {
          this.editor?.nativeElement.firstElementChild?.classList.add('toastui-editor-dark');
        } else {
          this.editor?.nativeElement.firstElementChild?.classList.remove('toastui-editor-dark');
        }
      }
    }))
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.editorInstance?.off('change');
    this.editorInstance?.off('blur');
  }

  get editor(): ElementRef<HTMLTextAreaElement> | undefined {
    return this._editor;
  }

  @ViewChild('editor')
  set editor(value: ElementRef<HTMLTextAreaElement>) {
    this._editor = value;
    if (!this.editorInstance && this.admin.getTemplate('md.wysiwyg')) {
      const editor = new Editor({
        el: this._editor!.nativeElement,
        height: '200px',
        initialEditType: 'wysiwyg',
        initialValue: this.currentText,
        previewStyle: 'vertical',
        theme: this.store.darkTheme ? 'dark' : 'light',
      });
      for (const plugin of this.editorPlugins) {
        editor.insertToolbarItem({ groupIndex: 5, itemIndex: 0 }, {
          name: plugin.tag,
          tooltip: plugin.name || plugin.tag,
          command: plugin.tag,
          text: plugin.config!.editor,
          className: 'toastui-editor-toolbar-icons',
          style: { backgroundImage: 'none' }
        });
        editor.addCommand('wysiwyg', plugin.tag, () => (this.toggleTag(plugin.tag), true));
        editor.addCommand('markdown', plugin.tag, () => (this.toggleTag(plugin.tag), true));
      }
      if (this.admin.getTemplate('html.markdown')) {
        editor.insertToolbarItem({ groupIndex: 5, itemIndex: 0 }, {
          name: 'html.markdown',
          tooltip: $localize`Convert HTML to Markdown`,
          command: 'html.markdown',
          text: $localize`⬇️`,
          className: 'toastui-editor-toolbar-icons',
          style: { backgroundImage: 'none' }
        });
        editor.addCommand('wysiwyg', 'html.markdown', () => (this.htmlToMarkdown(), true));
        editor.addCommand('markdown', 'html.markdown', () => (this.htmlToMarkdown(), true));
      }
      editor.on('change', () => this.setText(editor.getMarkdown()));
      editor.on('blur', () => {
        const md = editor.getMarkdown();
        this.control.setValue(md);
        this.syncText(md);
      });
      this.editorInstance = editor;
      this.control.valueChanges.pipe(
        takeUntil(this.destroy$),
      ).subscribe(comment => {
        if (this.editorInstance!.getMarkdown() === comment) return;
        this.editorInstance!.setMarkdown(comment);
      });
    }
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
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
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
      this._editor?.nativeElement.focus();
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

  htmlToMarkdown() {
    this.europa ||= new Europa({
      absolute: !!this.url,
      baseUri: this.url,
      inline: true,
    });
    const md = this.europa.convert(this.control.value);
    this.control.setValue(md);
    this.editorInstance?.setMarkdown(md);
    this.syncText(md);
  }
}
