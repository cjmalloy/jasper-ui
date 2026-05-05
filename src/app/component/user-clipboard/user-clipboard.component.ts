import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import DOMPurify from 'dompurify';
import { autorun, IReactionDisposer } from 'mobx';
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
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|jpg|gif|webp|bmp);base64,/i;
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'i', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'],
  ALLOWED_ATTR: ['alt', 'href', 'title'],
  ALLOW_DATA_ATTR: false,
};

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

type ClipboardItemContent = Omit<ClipboardItem, 'id' | 'created' | 'x' | 'y'>;

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
  private suppressedSelect?: ClipboardItem;
  private disposers: IReactionDisposer[] = [];
  private loading = true;
  dropActive = false;
  dropFilled = false;

  constructor(
    public store: Store,
    private admin: AdminService,
    private refs: RefService,
    private stomp: StompService,
  ) { }

  ngOnInit() {
    this.loadLocal();
    this.loadRemote();
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'clip' && this.store.eventBus.ref?.url) {
        this.addRef(this.store.eventBus.ref);
      }
    }));
    this.watch = this.stomp.watchRef(this.refUrl).pipe(
      catchError(() => of(undefined)),
    ).subscribe(ref => {
      if (ref) this.applyRemote(ref);
    });
  }

  ngOnDestroy() {
    this.watch?.unsubscribe();
    this.save?.unsubscribe();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get plugin(): Plugin | undefined {
    return this.admin.getPlugin(PLUGIN_TAG);
  }

  get interceptCopy() {
    return !!this.pluginSetting('interceptCopy');
  }

  get interceptPaste() {
    return !!this.pluginSetting('interceptPaste');
  }

  hasPendingPaste() {
    return this.items.find(item => item.selected);
  }

  get refUrl() {
    return `tag:/${this.store.account.localTag}?url=tag:/${PLUGIN_TAG}`;
  }

  get storageKey() {
    return `jasper.clipboard.${this.store.account.tagWithOrigin || 'anon'}`;
  }

  preview(item: ClipboardItem) {
    const text = this.previewText(item).replace(/\s+/g, ' ').trim();
    return text.length > MAX_PREVIEW_LENGTH ? text.substring(0, PREVIEW_TRUNCATE_AT) + '…' : text || '∅';
  }

  previewLabel(item: ClipboardItem) {
    return $localize`Clipboard item: ${this.preview(item)}`;
  }

  previewText(item: ClipboardItem) {
    if (item.text) return item.text;
    if (item.ref?.title) return item.ref.title;
    if (item.ref?.url) return item.ref.url;
    if (item.image) return $localize`Image`;
    if (item.html) return $localize`HTML`;
    return '';
  }

  select(item: ClipboardItem) {
    if (this.suppressedSelect === item || this.drag?.moved) {
      this.suppressedSelect = undefined;
      return;
    }
    item.selected = true;
    this.persistLocalOnly();
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
    this.persistLocalOnly();
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
    return !!item.ref;
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive = true;
  }

  dragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive = false;
  }

  drop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive = false;
    this.dropFilled = true;
    this.addFromDataTransfer(event.dataTransfer);
    window.setTimeout(() => this.dropFilled = false, 800);
  }

  pointerDown(event: PointerEvent, item: ClipboardItem) {
    if (event.button !== 0) return;
    if (this.isInteractive(event.target as HTMLElement | null)) return;
    this.suppressedSelect = undefined;
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
    const item = this.drag.item;
    this.drag = undefined;
    if (moved) {
      this.suppressedSelect = item;
      this.persist();
    }
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
    if (this.hasPendingPaste()) {
      this.pasteInto(event.target as HTMLElement);
      return;
    }
    this.addFromClipboardData(event.clipboardData);
  }

  @HostListener('document:focusin', ['$event'])
  focusIn(event: FocusEvent) {
    if (!this.hasPendingPaste()) return;
    this.pasteInto(event.target as HTMLElement);
  }

  private addItem(item: ClipboardItemContent) {
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

  private addRef(ref: Ref) {
    this.addItem({
      ref: {
        url: ref.url,
        origin: ref.origin,
        title: ref.title,
      },
    });
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
      if (this.insertListItems(target, items)) return true;
      const text = items.map(item => this.plainText(item, target)).join('');
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

  private insertListItems(target: HTMLInputElement | HTMLTextAreaElement, items: ClipboardItem[]) {
    const values = items.map(item => this.plainText(item, target));
    const listEditor = target.closest('app-list-editor') as HTMLElement | null;
    if (listEditor) {
      const event = new CustomEvent('jasper-clipboard-paste', { bubbles: true, cancelable: true, detail: values });
      listEditor.dispatchEvent(event);
      if (event.defaultPrevented) return true;
      const input = listEditor.querySelector('input') as HTMLInputElement | null;
      const add = listEditor.querySelector('button') as HTMLButtonElement | null;
      if (!input || !add) return false;
      for (const value of values) {
        this.setInputValue(input, value);
        add.click();
      }
      return true;
    }

    const formlyList = target.closest('formly-list-section') as HTMLElement | null;
    if (!formlyList) return false;
    const event = new CustomEvent('jasper-clipboard-paste', { bubbles: true, cancelable: true, detail: values });
    return !formlyList.dispatchEvent(event) || event.defaultPrevented;
  }

  private setInputValue(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private isInteractive(target: HTMLElement | null) {
    return !!target?.closest('button, input, textarea, select, a, [contenteditable="true"], [role="button"], [role="link"]');
  }

  private isTagField(target?: HTMLElement) {
    return !!target?.closest('formly-field-tag-input');
  }

  private isEditorField(target?: HTMLElement) {
    return !!target?.closest('app-editor');
  }

  private formatTagText(text: string, prefix: string) {
    if (text.startsWith('tag:/')) {
      return prefix + text.substring('tag:/'.length);
    }
    return text;
  }

  private plainText(item: ClipboardItem, target?: HTMLElement) {
    const text = item.text || item.ref?.url || (item.html ? this.stripHtml(item.html) : item.image || '');
    if (this.isTagField(target)) return this.formatTagText(text, '');
    if (this.isEditorField(target)) return this.formatTagText(text, '#');
    return text;
  }

  private richNodes(item: ClipboardItem) {
    if (item.html) {
      const template = document.createElement('template');
      template.innerHTML = DOMPurify.sanitize(item.html, SANITIZE_CONFIG);
      return Array.from(template.content.childNodes);
    }
    if (item.image) {
      if (!this.safeImage(item.image)) return [document.createTextNode(this.plainText(item))];
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = this.previewText(item) || $localize`Clipboard image`;
      return [image];
    }
    return [document.createTextNode(this.plainText(item))];
  }

  private clipboardItem(target: HTMLElement | null): ClipboardItemContent | undefined {
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
    this.addFromDataTransfer(data);
  }

  private addFromDataTransfer(data: DataTransfer | null) {
    if (!data) return;
    const text = data.getData('text/plain') || undefined;
    const html = data.getData('text/html') || undefined;
    const ref = this.refFromDataTransfer(data, html, text);
    const imageItem = Array.from(data.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (!imageItem) {
      if (text || html || ref) this.addItem({ text, html, ref });
      return;
    }
    const file = imageItem.getAsFile();
    if (!file) {
      if (text || html || ref) this.addItem({ text, html, ref });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = reader.result as string;
      if (this.safeImage(image)) {
        this.addItem({ text, html, image, ref });
      } else if (text || html || ref) {
        this.addItem({ text, html, ref });
      }
    };
    reader.onerror = () => {
      if (text || html || ref) this.addItem({ text, html, ref });
    };
    reader.readAsDataURL(file);
  }

  private refFromDataTransfer(data: DataTransfer, html?: string, text?: string): ClipboardRef | undefined {
    const uri = data.getData('text/uri-list').split('\n').find(line => !!line && !line.startsWith('#'));
    const htmlRef = html ? this.refFromHtml(html) : undefined;
    const textUri = text && this.isUri(text) ? text : undefined;
    const url = uri || htmlRef?.url || textUri;
    if (!url) return undefined;
    return {
      url,
      title: htmlRef?.title || this.titleFromDroppedText(text, !!textUri),
    };
  }

  private titleFromDroppedText(text: string | undefined, textIsUri: boolean) {
    return textIsUri ? undefined : text;
  }

  private refFromHtml(html: string): ClipboardRef | undefined {
    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG);
    const link = template.content.querySelector('a[href]') as HTMLAnchorElement | null;
    if (link) return { url: link.href, title: this.cleanTitle(link.textContent, link.title) };
    const image = template.content.querySelector('img[src]') as HTMLImageElement | null;
    if (image?.src && this.safeImage(image.src)) return { url: image.src, title: this.cleanTitle(image.alt, image.title) };
    return undefined;
  }

  private cleanTitle(...values: Array<string | null | undefined>) {
    return values.map(value => value?.trim()).find(value => !!value) || undefined;
  }

  private isUri(text: string) {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  private stripHtml(html: string) {
    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG);
    return template.content.textContent || '';
  }

  private safeImage(image: string) {
    return IMAGE_DATA_URL_PATTERN.test(image);
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
        ...this.mergeItemState(item, localState.get(item.id), index, includeItemState),
      }));
  }

  private mergeItemState(item: any, local: ClipboardItem | undefined, index: number, includeItemState: boolean) {
    return {
      x: includeItemState && typeof item.x === 'number' ? item.x : local?.x ?? BUBBLE_START_X,
      y: includeItemState && typeof item.y === 'number' ? item.y : local?.y ?? BUBBLE_START_Y + index * BUBBLE_SPACING,
      hold: includeItemState ? !!item.hold : local?.hold ?? false,
      selected: local?.selected,
      editing: local?.editing,
    };
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

  private persistLocalOnly() {
    this.persistLocal();
  }

  private pluginSetting(key: 'interceptCopy' | 'interceptPaste') {
    const value = this.plugin?.config?.[key];
    const fallback = this.plugin?.defaults?.[key];
    return typeof value === 'boolean' ? value : (typeof fallback === 'boolean' ? fallback : false);
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
