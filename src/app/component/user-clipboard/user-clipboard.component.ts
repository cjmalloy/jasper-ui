import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import DOMPurify from 'dompurify';
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
  created: string;
  text?: string;
  html?: string;
  image?: string;
  ref?: ClipboardRef;
  x: number;
  y: number;
  selected?: boolean;
  hold?: boolean;
  editing?: boolean;
}

interface ClipboardRef {
  url: string;
  origin?: string;
  title?: string;
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
    const text = (item.text || item.ref?.title || item.ref?.url || (item.image ? $localize`Image` : item.html ? $localize`HTML` : '')).replace(/\s+/g, ' ').trim();
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
    item.editing = false;
    this.persist();
  }

  edit(item: ClipboardItem, event?: Event) {
    event?.stopPropagation();
    item.editing = !item.editing;
    this.persist(false);
  }

  updateText(item: ClipboardItem, text: string) {
    item.text = text;
    this.persist();
  }

  updateRefTitle(item: ClipboardItem, title: string) {
    if (!item.ref) return;
    item.ref = { ...item.ref, title };
    this.persist();
  }

  updateRefUrl(item: ClipboardItem, url: string) {
    if (!item.ref) return;
    item.ref = { ...item.ref, url };
    this.persist();
  }

  canEdit(item: ClipboardItem) {
    return item.text !== undefined || !!item.ref;
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
    const item = this.clipboardItem(event.target as HTMLElement);
    if (!item) return;
    event.preventDefault();
    this.addItem(item);
  }

  @HostListener('document:paste', ['$event'])
  paste(event: ClipboardEvent) {
    if (!this.interceptPaste) return;
    event.preventDefault();
    if (this.pendingPaste) {
      this.pasteInto(event.target as HTMLElement);
      return;
    }
    this.addFromClipboardData(event.clipboardData);
  }

  @HostListener('document:focusin', ['$event'])
  focusIn(event: FocusEvent) {
    if (!this.pendingPaste) return;
    this.pasteInto(event.target as HTMLElement);
  }

  private addItem(item: Omit<ClipboardItem, 'id' | 'created' | 'x' | 'y'>) {
    const y = BUBBLE_START_Y + this.items.length * BUBBLE_SPACING;
    this.items = [
      ...this.items,
      {
        id: crypto.randomUUID(),
        created: new Date().toISOString(),
        x: BUBBLE_START_X,
        y,
        ...item,
      },
    ];
    this.persist();
  }

  private pasteInto(target: HTMLElement | null) {
    const items = this.items.filter(item => item.selected);
    if (!target || !items.length) return;
    if (!this.insertItems(target, items)) return;
    for (const item of items) {
      if (!item.hold) item.selected = false;
    }
    this.persist();
  }

  private insertItems(target: HTMLElement, items: ClipboardItem[]) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const text = items.map(item => this.plainText(item)).join('');
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
      const fragment = document.createDocumentFragment();
      for (const item of items) {
        fragment.append(...this.richNodes(item));
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  private plainText(item: ClipboardItem) {
    return item.text || item.ref?.url || (item.html ? this.stripHtml(item.html) : item.image || '');
  }

  private richNodes(item: ClipboardItem) {
    if (item.html) {
      const template = document.createElement('template');
      template.innerHTML = DOMPurify.sanitize(item.html);
      return Array.from(template.content.childNodes);
    }
    if (item.image) {
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = item.text || item.ref?.title || item.ref?.url || $localize`Clipboard image`;
      return [image];
    }
    return [document.createTextNode(this.plainText(item))];
  }

  private clipboardItem(target: HTMLElement | null): Omit<ClipboardItem, 'id' | 'created' | 'x' | 'y'> | undefined {
    const text = this.selectedText(target);
    const html = this.selectedHtml();
    const ref = this.selectedRef(target);
    if (!text && !html && !ref) return undefined;
    return { text: text || undefined, html: html || undefined, ref };
  }

  private selectedText(target: HTMLElement | null) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value.substring(target.selectionStart ?? 0, target.selectionEnd ?? target.value.length);
    }
    return window.getSelection()?.toString() || '';
  }

  private selectedHtml() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return '';
    const fragment = selection.getRangeAt(0).cloneContents();
    const container = document.createElement('div');
    container.appendChild(fragment);
    return container.innerHTML;
  }

  private selectedRef(target: HTMLElement | null): ClipboardRef | undefined {
    const refEl = target?.closest('.ref[data-ref-url]') as HTMLElement | null;
    const url = refEl?.dataset['refUrl'];
    if (!url) return undefined;
    return {
      url,
      origin: refEl.dataset['refOrigin'] || undefined,
      title: refEl.dataset['refTitle'] || undefined,
    };
  }

  private addFromClipboardData(data: DataTransfer | null) {
    if (!data) return;
    const text = data.getData('text/plain') || undefined;
    const html = data.getData('text/html') || undefined;
    const imageItem = Array.from(data.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (!imageItem) {
      if (text || html) this.addItem({ text, html });
      return;
    }
    const file = imageItem.getAsFile();
    if (!file) {
      if (text || html) this.addItem({ text, html });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.addItem({ text, html, image: reader.result as string });
    reader.readAsDataURL(file);
  }

  private stripHtml(html: string) {
    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(html);
    return template.content.textContent || '';
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
    this.items = this.sanitise(remoteItems, this.items, false);
    this.persistLocal();
  }

  private sanitise(items: any[], previous: ClipboardItem[] = [], includeItemState = true): ClipboardItem[] {
    const localState = new Map(previous.map(item => [item.id, item]));
    return items
      .filter(item => typeof item?.id === 'string' && this.hasContent(item))
      .map((item, index) => ({
        id: item.id,
        text: typeof item.text === 'string' ? item.text : undefined,
        html: typeof item.html === 'string' ? item.html : undefined,
        image: typeof item.image === 'string' ? item.image : undefined,
        ref: this.sanitiseRef(item.ref),
        created: typeof item.created === 'string' ? item.created : new Date().toISOString(),
        x: includeItemState && typeof item.x === 'number' ? item.x : localState.get(item.id)?.x ?? BUBBLE_START_X,
        y: includeItemState && typeof item.y === 'number' ? item.y : localState.get(item.id)?.y ?? BUBBLE_START_Y + index * BUBBLE_SPACING,
        hold: includeItemState && !!item.hold || localState.get(item.id)?.hold,
        selected: localState.get(item.id)?.selected,
        editing: localState.get(item.id)?.editing,
      }));
  }

  private hasContent(item: any) {
    return typeof item?.text === 'string' ||
      typeof item?.html === 'string' ||
      typeof item?.image === 'string' ||
      !!this.sanitiseRef(item?.ref);
  }

  private sanitiseRef(ref: any): ClipboardRef | undefined {
    if (!ref || typeof ref.url !== 'string') return undefined;
    return {
      url: ref.url,
      origin: typeof ref.origin === 'string' ? ref.origin : undefined,
      title: typeof ref.title === 'string' ? ref.title : undefined,
    };
  }

  private persist(remote = true) {
    this.persistLocal();
    if (remote && !this.loading) this.persistRemote();
  }

  private persistLocal() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items.map(item => ({
        ...this.serializeLocal(item),
      }))));
    } catch {
      // Local storage is best-effort.
    }
  }

  private persistRemote() {
    if (!this.store.account.signedIn) return;
    const ref = this.clipboardRef(this.remote);
    this.save?.unsubscribe();
    if (!this.remote) {
      this.save = this.refs.get(this.refUrl, this.store.account.origin).pipe(
        catchError(() => of(undefined)),
      ).subscribe(existing => {
        if (existing) {
          this.remote = existing;
          this.sendRemote(this.clipboardRef(existing), true);
        } else {
          this.sendRemote(ref, false);
        }
      });
      return;
    }
    this.sendRemote(ref, true);
  }

  private clipboardRef(remote?: Ref): Ref {
    const ref: Ref = {
      ...(remote || {}),
      url: this.refUrl,
      origin: this.store.account.origin,
      title: 'Clipboard',
      tags: [this.store.account.localTag, PLUGIN_TAG, 'internal'],
      plugins: {
        ...(remote?.plugins || {}),
        [PLUGIN_TAG]: {
          items: this.items.map(item => this.serializeRemote(item)),
        },
      },
    };
    return ref;
  }

  private sendRemote(ref: Ref, update: boolean) {
    const request = update ? this.refs.update(ref) : this.refs.create(ref);
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

  private serializeRemote(item: ClipboardItem) {
    return {
      id: item.id,
      created: item.created,
      ...(item.text !== undefined ? { text: item.text } : {}),
      ...(item.html !== undefined ? { html: item.html } : {}),
      ...(item.image !== undefined ? { image: item.image } : {}),
      ...(item.ref ? { ref: item.ref } : {}),
    };
  }

  private serializeLocal(item: ClipboardItem) {
    return {
      ...this.serializeRemote(item),
      x: item.x,
      y: item.y,
      ...(item.hold ? { hold: true } : {}),
    };
  }
}
