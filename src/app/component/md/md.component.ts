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
import { EmbedService, MdRoot } from '../../service/embed.service';
import { Store } from '../../store/store';
import {
  destroyIslands,
  matchBlocks,
  MdBlock,
  mdBlocks,
  MdIslands,
  morphRange,
  pairBlocks,
  shiftSourceMap
} from '../../util/markdown';

interface MdBlockState {
  key: string;
  offset: number;
  marker: Comment;
  islands: MdIslands;
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
  private lastText?: string;
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
    if (this._text === this.lastText && options === this.lastOptions) return;
    this.lastText = this._text;
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
    for (const b of this.blocks) {
      for (const [start, island] of b.islands) {
        for (let n = start.nextSibling; n && n !== island.end; n = n.nextSibling) {
          if (n instanceof Element && (n.tagName === 'IFRAME' || n.querySelector('iframe'))) {
            island.key = '';
            b.key = '';
            stale = true;
            break;
          }
        }
      }
    }
    if (stale) this.reconcile();
  }

  private destroy() {
    this.cleanup?.();
    delete this.cleanup;
    for (const b of this.blocks) this.destroyBlock(b);
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
   * Changed blocks that share hydrated content with a removed block in the same
   * position are updated in place, keeping the shared embeds.
   * Renders every block if reference links changed.
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
    const reuse = !full && links === this.links && !!this.blocks.length;
    const matched = reuse ? matchBlocks(this.blocks, next) : new Array<MdBlockState | undefined>(next.length).fill(undefined);
    const roots = new Map<number, MdRoot>();
    next.forEach((b, i) => {
      if (!matched[i]) roots.set(i, this.embeds.renderBlock(b, tokens.links, this.origin || '', this.disableSanitizer));
    });
    const paired = reuse ? pairBlocks(this.blocks, matched, i => roots.get(i)?.islands) : [];
    if (!reuse) {
      this.destroy();
      host.replaceChildren();
    } else {
      const kept = new Set([...matched, ...paired]);
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
      } else if (paired[i]) {
        blocks[i] = this.updateBlock(paired[i]!, next[i], roots.get(i)!, tokens.links, ref);
      } else {
        blocks[i] = this.insertBlock(next[i], roots.get(i)!, ref);
      }
      ref = blocks[i].marker;
    }
    this.blocks = blocks;
    this.links = links;
    this.postProcessMarkdown.next();
  }

  private insertBlock(block: MdBlock, { root, islands }: MdRoot, ref: Node | null): MdBlockState {
    const host = this.md.nativeElement;
    const state: MdBlockState = {
      key: block.key,
      offset: block.offset,
      marker: host.ownerDocument.createComment('md-block'),
      islands: new Map(),
    };
    for (const [start, island] of islands) {
      this.embeds.hydrateIsland(start, island, this.context);
      state.islands.set(start, island);
    }
    const fragment = host.ownerDocument.createDocumentFragment();
    fragment.append(state.marker, ...Array.from(root.childNodes));
    host.insertBefore(fragment, ref);
    return state;
  }

  /**
   * Update a block in place to match a new render, keeping islands that did not change.
   * Falls back to replacing the block if the update fails.
   */
  private updateBlock(block: MdBlockState, next: MdBlock, root: MdRoot, links: any, ref: Node | null): MdBlockState {
    const host = this.md.nativeElement;
    try {
      morphRange(host, block.marker.nextSibling, ref, root.root, {
        host,
        live: block.islands,
        next: root.islands,
        hydrate: (start, island) => this.embeds.hydrateIsland(start, island, this.context),
      });
    } catch (e) {
      console.error(e);
      this.removeBlock(block, ref);
      return this.insertBlock(next, this.embeds.renderBlock(next, links, this.origin || '', this.disableSanitizer), ref);
    }
    block.key = next.key;
    block.offset = next.offset;
    return block;
  }

  private destroyBlock(block: MdBlockState) {
    destroyIslands(Array.from(block.islands.keys()), block.islands);
  }

  private removeBlock(block: MdBlockState, end: Node | null) {
    this.destroyBlock(block);
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
