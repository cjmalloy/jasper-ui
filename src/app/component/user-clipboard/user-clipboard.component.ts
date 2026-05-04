import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { catchError, of, Subscription } from 'rxjs';
import { Plugin } from '../../model/plugin';
import { Ref, RefUpdates } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { Store } from '../../store/store';

const PLUGIN_TAG = 'plugin/user/clipboard';
const BUBBLE_START_X = 12;
const BUBBLE_START_Y = 72;
const BUBBLE_SPACING = 56;
const BUBBLE_WIDTH_OFFSET = 80;
const BUBBLE_HEIGHT_OFFSET = 40;
const MAX_PREVIEW_LENGTH = 48;
const PREVIEW_TRUNCATE_AT = 45;

interface ClipboardItem {
  id: string;
  text: string;
  created: string;
  x: number;
  y: number;
  selected?: boolean;
  hold?: boolean;
}

interface DragState {
  item: ClipboardItem;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

@Component({
  selector: 'app-user-clipboard',
  templateUrl: './user-clipboard.component.html',
  styleUrls: ['./user-clipboard.component.scss'],
  host: { 'class': 'user-clipboard' },
})
export class UserClipboardComponent implements OnInit, OnDestroy {

  items: ClipboardItem[] = [];
  private remote?: Ref;
  private watch?: Subscription;
  private save?: Subscription;
  private drag?: DragState;
  private loading = true;

  constructor(
    public store: Store,
    private admin: AdminService,
    private refs: RefService,
    private stomp: StompService,
  ) { }

  ngOnInit() {
    this.loadLocal();
    this.loadRemote();
    this.watch = this.stomp.watchRef(this.refUrl).pipe(
      catchError(() => of(undefined)),
    ).subscribe(ref => {
      if (ref) this.applyRemote(ref);
    });
  }

  ngOnDestroy() {
    this.watch?.unsubscribe();
    this.save?.unsubscribe();
  }

  get plugin(): Plugin | undefined {
    return this.admin.getPlugin(PLUGIN_TAG);
  }

  get interceptCopy() {
    return !!this.plugin?.config?.interceptCopy;
  }

  get interceptPaste() {
    return !!this.plugin?.config?.interceptPaste;
  }

  get pendingPaste() {
    return this.items.find(item => item.selected);
  }

  get refUrl() {
    return `tag:/${this.store.account.localTag}?url=tag:/${PLUGIN_TAG}`;
  }

  get storageKey() {
    return `jasper.clipboard.${this.store.account.tagWithOrigin || 'anon'}`;
  }

  preview(item: ClipboardItem) {
    const text = item.text.replace(/\s+/g, ' ').trim();
    return text.length > MAX_PREVIEW_LENGTH ? text.substring(0, PREVIEW_TRUNCATE_AT) + '…' : text || '∅';
  }

  previewLabel(item: ClipboardItem) {
    return $localize`Clipboard item: ${this.preview(item)}`;
  }

  select(item: ClipboardItem) {
    if (this.drag?.moved) return;
    item.selected = true;
    this.persist(false);
  }

  clear(item: ClipboardItem, event?: Event) {
    event?.stopPropagation();
    this.items = this.items.filter(i => i.id !== item.id);
    this.persist();
  }

  hold(item: ClipboardItem, event?: Event) {
    event?.stopPropagation();
    item.hold = !item.hold;
    item.selected = true;
    this.persist();
  }

  reset(item: ClipboardItem, event?: Event) {
    event?.stopPropagation();
    item.selected = false;
    item.hold = false;
    this.persist();
  }

  pointerDown(event: PointerEvent, item: ClipboardItem) {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    this.drag = {
      item,
      offsetX: event.clientX - item.x,
      offsetY: event.clientY - item.y,
      moved: false,
    };
  }

  pointerMove(event: PointerEvent) {
    if (!this.drag) return;
    const x = Math.max(0, Math.min(window.innerWidth - BUBBLE_WIDTH_OFFSET, event.clientX - this.drag.offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - BUBBLE_HEIGHT_OFFSET, event.clientY - this.drag.offsetY));
    if (Math.abs(x - this.drag.item.x) > 3 || Math.abs(y - this.drag.item.y) > 3) this.drag.moved = true;
    this.drag.item.x = x;
    this.drag.item.y = y;
  }

  pointerUp() {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = undefined;
    if (moved) this.persist();
  }

  @HostListener('document:copy', ['$event'])
  copy(event: ClipboardEvent) {
    if (!this.interceptCopy) return;
    const text = this.selectedText(event.target as HTMLElement);
    if (!text) return;
    event.preventDefault();
    this.addText(text);
  }

  @HostListener('document:paste', ['$event'])
  paste(event: ClipboardEvent) {
    if (!this.interceptPaste) return;
    if (!this.items.length) return;
    event.preventDefault();
    this.pasteInto(event.target as HTMLElement);
  }

  @HostListener('document:focusin', ['$event'])
  focusIn(event: FocusEvent) {
    if (!this.pendingPaste) return;
    this.pasteInto(event.target as HTMLElement);
  }

  private addText(text: string) {
    const y = BUBBLE_START_Y + this.items.length * BUBBLE_SPACING;
    this.items = [
      ...this.items,
      {
        id: crypto.randomUUID(),
        text,
        created: new Date().toISOString(),
        x: BUBBLE_START_X,
        y,
      },
    ];
    this.persist();
  }

  private pasteInto(target: HTMLElement | null) {
    const items = this.items.filter(item => item.selected);
    if (!target || !items.length) return;
    const text = items.map(item => item.text).join('');
    if (!this.insertText(target, text)) return;
    for (const item of items) {
      if (!item.hold) item.selected = false;
    }
    this.persist();
  }

  private insertText(target: HTMLElement, text: string) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.setRangeText(text, start, end, 'end');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (target.isContentEditable) {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return false;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  private selectedText(target: HTMLElement | null) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value.substring(target.selectionStart ?? 0, target.selectionEnd ?? 0);
    }
    return window.getSelection()?.toString() || '';
  }

  private loadLocal() {
    try {
      const items = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      if (Array.isArray(items)) this.items = this.sanitise(items);
    } catch {
      this.items = [];
    }
  }

  private loadRemote() {
    this.refs.get(this.refUrl, this.store.account.origin).pipe(
      catchError(() => of(undefined)),
    ).subscribe(ref => {
      this.loading = false;
      if (!ref) {
        this.persist();
        return;
      }
      this.remote = ref;
      this.applyRemote(ref);
    });
  }

  private applyRemote(ref: Ref | RefUpdates) {
    const remoteItems = ref.plugins?.[PLUGIN_TAG]?.items;
    if (!Array.isArray(remoteItems)) return;
    this.items = this.sanitise(remoteItems);
    this.persistLocal();
  }

  private sanitise(items: any[]): ClipboardItem[] {
    return items
      .filter(item => typeof item?.id === 'string' && typeof item?.text === 'string')
      .map((item, index) => ({
        id: item.id,
        text: item.text,
        created: typeof item.created === 'string' ? item.created : new Date().toISOString(),
        x: typeof item.x === 'number' ? item.x : BUBBLE_START_X,
        y: typeof item.y === 'number' ? item.y : BUBBLE_START_Y + index * BUBBLE_SPACING,
        hold: !!item.hold,
        selected: !!item.selected,
      }));
  }

  private persist(remote = true) {
    this.persistLocal();
    if (remote && !this.loading) this.persistRemote();
  }

  private persistLocal() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items.map(item => ({
        ...this.serialize(item),
      }))));
    } catch {
      // Local storage is best-effort.
    }
  }

  private persistRemote() {
    if (!this.store.account.signedIn) return;
    const ref: Ref = {
      ...(this.remote || {}),
      url: this.refUrl,
      origin: this.store.account.origin,
      title: 'Clipboard',
      tags: [this.store.account.localTag, PLUGIN_TAG, 'internal'],
      plugins: {
        ...(this.remote?.plugins || {}),
        [PLUGIN_TAG]: {
          items: this.items.map(item => this.serialize(item)),
        },
      },
    };
    const request = this.remote ? this.refs.update(ref) : this.refs.create(ref);
    this.save?.unsubscribe();
    this.save = request.pipe(
      catchError(() => of(undefined)),
    ).subscribe(cursor => {
      if (cursor) {
        this.remote = {
          ...ref,
          modifiedString: cursor,
        };
      }
    });
  }

  private serialize(item: ClipboardItem) {
    return {
      id: item.id,
      text: item.text,
      created: item.created,
      x: item.x,
      y: item.y,
      ...(item.hold ? { hold: true } : {}),
    };
  }
}
