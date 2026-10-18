import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { AdminService } from '../../service/admin.service';
import { EmbedService } from '../../service/embed.service';
import { Store } from '../../store/store';
import { matchBlocks, MdBlock, mdBlocks, shiftSourceMap, trackViews } from '../../util/markdown';

interface MdBlockState {
  key: string;
  offset: number;
  marker: Comment;
  cleanup: () => void;
}

@Component({
  selector: 'app-md',
  templateUrl: './md.component.html',
  styleUrls: ['./md.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MdComponent implements DoCheck, OnDestroy {

  @Input()
  origin? = '';
  @Input()
  plugins?: string[];
  @Input()
  disableSanitizer = false;
  @Output()
  postProcessMarkdown: Subject<void> = new Subject();
  @Input()
  mermaid = true;
  @Input()
  clipboard = true;
  /**
   * Only re-render and re-hydrate the top-level blocks that changed when the text changes.
   */
  @Input()
  progressive = false;

  @ViewChild('md', { static: true })
  md!: ElementRef<HTMLDivElement>;
  @ViewChild('md', { static: true, read: ViewContainerRef })
  vc!: ViewContainerRef;

  private _text = '';
  private _value? = '';
  private lastRender?: string;
  private lastOptions?: string;
  private cleanup?: () => void;
  private blocks: MdBlockState[] = [];
  private links?: string;
  private frame?: () => void;

  constructor(
    public admin: AdminService,
    public store: Store,
    public el: ElementRef,
    private embeds: EmbedService,
    private zone: NgZone,
  ) { }

  get text(): string {
    return this._text;
  }

  @Input()
  set text(value: string | undefined) {
    this._text = value || '';
    delete this._value;
  }

  get value() {
    if (this.plugins?.includes('plugin/table')) {
      if (this._value) return this._value;
      try {
        const wb = XLSX.read(this._text, {type: 'string'});
        return this._value = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]], {header: ''});
      } catch (e: any) {
        return `<p class="error">${e.message}</p>`
      }
    }
    return this._value = this._text;
  }

  get katex() {
    return !!this.plugins?.includes('plugin/latex');
  }

  ngDoCheck() {
    const options = JSON.stringify([this.plugins || [], this.origin || '', this.mermaid, this.clipboard, this.disableSanitizer, this.progressive]);
    const key = JSON.stringify([this._text, options]);
    if (key === this.lastRender) return;
    this.lastRender = key;
    const textOnly = this.progressive && options === this.lastOptions;
    this.lastOptions = options;
    if (textOnly) {
      this.schedule();
    } else {
      this.cancel();
      this.render();
    }
  }

  ngOnDestroy() {
    this.cancel();
    this.destroy();
  }

  /**
   * Re-render anything containing an iframe. Browsers reload iframes from their
   * src attribute when they are moved in the DOM, which blanks embeds.
   * Call after moving this component, for example into a fullscreen overlay.
   */
  reloadIframes() {
    if (!this.progressive || !this.blocks.length) {
      if (!this.md.nativeElement.querySelector('iframe')) return;
      this.cancel();
      this.render();
      return;
    }
    let stale = false;
    this.blocks.forEach((b, i) => {
      const end = this.blocks[i + 1]?.marker || null;
      for (let n = b.marker.nextSibling; n && n !== end; n = n.nextSibling) {
        if (n instanceof Element && (n.tagName === 'IFRAME' || n.querySelector('iframe'))) {
          b.key = '';
          stale = true;
          break;
        }
      }
    });
    if (stale) this.reconcile();
  }

  private destroy() {
    this.cleanup?.();
    delete this.cleanup;
    for (const b of this.blocks) b.cleanup();
    this.blocks = [];
    delete this.links;
    this.vc.clear();
  }

  /**
   * Coalesce progressive text changes into a single reconcile per frame.
   */
  private schedule() {
    if (this.frame) return;
    this.zone.runOutsideAngular(() => {
      if (typeof requestAnimationFrame === 'function') {
        const id = requestAnimationFrame(() => this.reconcile());
        this.frame = () => cancelAnimationFrame(id);
      } else {
        const id = setTimeout(() => this.reconcile(), 100);
        this.frame = () => clearTimeout(id);
      }
    });
  }

  private cancel() {
    this.frame?.();
    delete this.frame;
  }

  private get context() {
    return {
      vc: this.vc,
      origin: this.origin || '',
      mermaid: this.mermaid,
      clipboard: this.clipboard,
    };
  }

  /**
   * Re-render only the top-level blocks that changed, keeping the DOM of the rest.
   * Falls back to rendering every block if reference links changed or most blocks changed.
   */
  private reconcile(full = false) {
    this.cancel();
    const host = this.md.nativeElement;
    let tokens: ReturnType<EmbedService['lex']>;
    try {
      tokens = this.embeds.lex(this.value, this.katex);
    } catch (e) {
      console.error(e);
      this.destroy();
      this.cleanup = this.embeds.render(host, this.value, this.context, this.katex, this.disableSanitizer);
      this.postProcessMarkdown.next();
      return;
    }
    const links = JSON.stringify(tokens.links);
    const next = mdBlocks(tokens);
    let matched = full || links !== this.links ? [] : matchBlocks(this.blocks, next);
    if (matched.filter(b => !b).length * 2 > next.length) matched = [];
    if (!matched.length) {
      this.destroy();
      host.replaceChildren();
    } else {
      const kept = new Set(matched);
      this.blocks.forEach((b, i) => {
        if (!kept.has(b)) this.removeBlock(b, this.blocks[i + 1]?.marker || null);
      });
    }
    const blocks: MdBlockState[] = new Array(next.length);
    let ref: Node | null = null;
    for (let i = next.length - 1; i >= 0; i--) {
      const old = matched[i];
      if (old) {
        shiftSourceMap(host, old.marker, ref, next[i].offset - old.offset);
        old.offset = next[i].offset;
        blocks[i] = old;
      } else {
        blocks[i] = this.renderBlock(next[i], tokens.links, ref);
      }
      ref = blocks[i].marker;
    }
    this.blocks = blocks;
    this.links = links;
    this.postProcessMarkdown.next();
  }

  private renderBlock(block: MdBlock, links: any, ref: Node | null): MdBlockState {
    const host = this.md.nativeElement;
    const views = trackViews(this.vc);
    const { nodes, cleanup } = this.embeds.renderBlock(block, links, { ...this.context, vc: views.vc }, this.disableSanitizer);
    const marker = host.ownerDocument.createComment('md-block');
    const fragment = host.ownerDocument.createDocumentFragment();
    fragment.append(marker, ...nodes);
    host.insertBefore(fragment, ref);
    return {
      key: block.key,
      offset: block.offset,
      marker,
      cleanup: () => {
        cleanup();
        views.destroy();
      },
    };
  }

  private removeBlock(block: MdBlockState, end: Node | null) {
    block.cleanup();
    let n: Node | null = block.marker;
    while (n && n !== end) {
      const next: Node | null = n.nextSibling;
      n.parentNode?.removeChild(n);
      n = next;
    }
  }

  private render() {
    if (this.progressive) {
      this.reconcile(true);
      return;
    }
    this.destroy();
    this.cleanup = this.embeds.render(this.md.nativeElement, this.value, this.context, this.katex, this.disableSanitizer);
    this.postProcessMarkdown.next();
  }
}
