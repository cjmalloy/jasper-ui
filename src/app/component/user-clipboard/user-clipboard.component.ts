import { OverlayModule } from '@angular/cdk/overlay';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import DOMPurify from 'dompurify';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { refForm, RefFormComponent } from '../../form/ref/ref.component';
import { Plugin } from '../../model/plugin';
import { Ref, RefUpdates } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { StompService } from '../../service/api/stomp.service';
import { TaggingService } from '../../service/api/tagging.service';
import { Store } from '../../store/store';

const BUBBLE_START_X = 12;
const BUBBLE_START_Y = 72;
const BUBBLE_SPACING = 56;
const BUBBLE_WIDTH_OFFSET = 80;
const BUBBLE_HEIGHT_OFFSET = 40;
const MAX_PREVIEW_LENGTH = 48;
const PREVIEW_TRUNCATE_AT = 45;
const TAG_URL_PREFIX = 'tag:/';
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
}

type ClipboardItemContent = Omit<ClipboardItem, 'id' | 'created' | 'x' | 'y'>;

interface ClipboardRef {
  url: string;
  origin?: string;
  title?: string;
  comment?: string;
  published?: string;
  modifiedString?: string;
  tags?: string[];
  sources?: string[];
  alternateUrls?: string[];
  plugins?: Record<string, unknown>;
}

interface DragState {
  item: ClipboardItem;
  element: HTMLElement;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

@Component({
  selector: 'app-user-clipboard',
  templateUrl: './user-clipboard.component.html',
  styleUrls: ['./user-clipboard.component.scss'],
  host: { 'class': 'user-clipboard' },
  imports: [
    OverlayModule,
    ReactiveFormsModule,
    RefFormComponent,
  ],
})
export class UserClipboardComponent implements OnInit, OnDestroy {

  items: ClipboardItem[] = [];
  editingItem?: ClipboardItem;
  editForm: UntypedFormGroup;
  private watch?: Subscription;
  private save?: Subscription;
  private drag?: DragState;
  private draggedRef?: ClipboardRef;
  private dropDragDepth = 0;
  private suppressedSelect?: ClipboardItem;
  private pendingRemotePersist = false;
  private savingRemote = false;
  private disposers: IReactionDisposer[] = [];
  private loading = false;
  dropVisible = false;
  dropActive = false;
  dropFilled = false;

  constructor(
    public store: Store,
    private admin: AdminService,
    private tags: TaggingService,
    private stomp: StompService,
    private fb: UntypedFormBuilder,
  ) {
    this.editForm = this.refEditForm();
  }

  ngOnInit() {
    this.loadLocal();
    this.loadRemote();
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'clip' && this.store.eventBus.ref?.url) {
        this.addRef(this.store.eventBus.ref);
      }
    }));
    this.watch = this.stomp.watchResponse('tag:plugin/user/clipboard').pipe(
      catchError(() => of(undefined)),
    ).subscribe(() => this.loadRemote());
  }

  ngOnDestroy() {
    this.watch?.unsubscribe();
    this.save?.unsubscribe();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get plugin(): Plugin | undefined {
    return this.admin.getPlugin('plugin/user/clipboard');
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
    if (this.isTagUrl(item.ref?.url)) return item.ref?.title || item.ref?.url?.substring(TAG_URL_PREFIX.length) || '';
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
    item.selected = !item.selected;
    this.persistLocalOnly();
  }

  clear(item: ClipboardItem, event?: Event) {
    event?.stopPropagation();
    this.items = this.items.filter(i => i.id !== item.id);
    this.persist();
  }

  setHold(item: ClipboardItem, checked: boolean, event?: Event) {
    event?.stopPropagation();
    item.hold = checked;
    item.selected = checked;
    this.persistLocalOnly();
  }

  @HostListener('document:dragenter', ['$event'])
  dragEnter(event: DragEvent) {
    if (this.isDropZoneTarget(event.target as HTMLElement | null)) return;
    this.dropDragDepth++;
    this.dropVisible = true;
  }

  @HostListener('document:dragleave', ['$event'])
  documentDragLeave(event: DragEvent) {
    if (this.isDropZoneTarget(event.target as HTMLElement | null)) return;
    this.dropDragDepth = Math.max(0, this.dropDragDepth - 1);
    if (!this.dropDragDepth) this.resetDropState();
  }

  @HostListener('document:drop', ['$event'])
  documentDrop(event: DragEvent) {
    if (this.isDropZoneTarget(event.target as HTMLElement | null)) return;
    this.resetDropState();
  }

  openEdit(item: ClipboardItem, event: Event) {
    if (!item.ref) return;
    event.preventDefault();
    event?.stopPropagation();
    item.selected = true;
    this.editingItem = item;
    this.editForm = this.refEditForm(item.ref);
    this.persistLocalOnly();
  }

  closeEdit(event?: Event) {
    event?.stopPropagation();
    this.editingItem = undefined;
  }

  saveEdit(event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.editingItem?.ref) return;
    this.editingItem.ref = this.refFromEditForm(this.editingItem.ref);
    this.editingItem = undefined;
    this.persist();
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
    this.resetDropState();
    this.dropFilled = true;
    this.addFromDataTransfer(event.dataTransfer);
    this.draggedRef = undefined;
    window.setTimeout(() => this.dropFilled = false, 800);
  }

  @HostListener('document:dragstart', ['$event'])
  dragStart(event: DragEvent) {
    this.draggedRef = this.refFromTarget(event.target as HTMLElement | null);
  }

  @HostListener('document:dragend')
  dragEnd() {
    this.resetDropState();
    this.draggedRef = undefined;
  }

  pointerDown(event: PointerEvent, item: ClipboardItem) {
    if (event.button !== 0) return;
    if (this.isInteractive(event.target as HTMLElement | null)) return;
    this.suppressedSelect = undefined;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    this.drag = {
      item,
      element: target,
      startX: item.x,
      startY: item.y,
      offsetX: event.clientX - item.x,
      offsetY: event.clientY - item.y,
      moved: false,
    };
  }

  pointerMove(event: PointerEvent) {
    if (!this.drag) return;
    const x = Math.max(0, Math.min(window.innerWidth - BUBBLE_WIDTH_OFFSET, event.clientX - this.drag.offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - BUBBLE_HEIGHT_OFFSET, event.clientY - this.drag.offsetY));
    if (Math.abs(x - this.drag.startX) > 3 || Math.abs(y - this.drag.startY) > 3) this.drag.moved = true;
    this.drag.item.x = x;
    this.drag.item.y = y;
    this.moveBubble(this.drag.element, x, y);
  }

  pointerUp(event: PointerEvent) {
    if (!this.drag) return;
    const { element, item, moved } = this.drag;
    this.clearPointerCapture(element, event.pointerId);
    this.drag = undefined;
    if (moved) {
      this.suppressedSelect = item;
      this.persistLocalOnly();
    }
  }

  cancelPointerDrag(event: PointerEvent) {
    const target = event.currentTarget;
    if (!this.drag || !(target instanceof HTMLElement) || target !== this.drag.element) return;
    const moved = this.drag.moved;
    this.clearPointerCapture(this.drag.element, event.pointerId);
    this.drag = undefined;
    if (moved) this.suppressedSelect = undefined;
  }

  private clearPointerCapture(element: HTMLElement, pointerId: number) {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
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
    if (this.isClipboardEditTarget(event.target as HTMLElement | null)) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.hasPendingPaste()) {
      this.pasteInto(event.target as HTMLElement);
      return;
    }
    this.addFromClipboardData(event.clipboardData);
  }

  @HostListener('document:focusin', ['$event'])
  focusIn(event: FocusEvent) {
    if (!this.hasPendingPaste()) return;
    if (this.isClipboardEditTarget(event.target as HTMLElement | null)) return;
    this.pasteInto(event.target as HTMLElement);
  }

  private addItem(item: ClipboardItemContent) {
    const y = BUBBLE_START_Y + this.items.length * BUBBLE_SPACING;
    this.items = [
      ...this.items,
      {
        id: uuid(),
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
    this.persistLocalOnly();
  }

  private insertItems(target: HTMLElement, items: ClipboardItem[]) {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      if (this.insertListItems(target, items)) return true;
      if (this.insertQueryItems(target, items)) return true;
      this.insertText(target, items.map(item => this.plainText(item, target)).join(''));
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
    const values = this.listPasteValues(target, items);
    const listEditor = target.closest('app-list-editor') as HTMLElement | null;
    if (listEditor) {
      const event = new CustomEvent('jasper-clipboard-paste', { bubbles: true, cancelable: true, detail: values });
      listEditor.dispatchEvent(event);
      if (event.defaultPrevented) {
        target.blur();
        return true;
      }
      const input = listEditor.querySelector('input') as HTMLInputElement | null;
      const add = listEditor.querySelector('button') as HTMLButtonElement | null;
      if (!input || !add) return false;
      for (const value of values) {
        this.setInputValue(input, value);
        add.click();
      }
      input.blur();
      return true;
    }

    const formlyList = target.closest('formly-list-section') as HTMLElement | null;
    if (!formlyList) return false;
    const event = new CustomEvent('jasper-clipboard-paste', { bubbles: true, cancelable: true, detail: values });
    formlyList.dispatchEvent(event);
    if (event.defaultPrevented) target.blur();
    return event.defaultPrevented;
  }

  private listPasteValues(target: HTMLInputElement | HTMLTextAreaElement, items: ClipboardItem[]) {
    if (this.isQueryField(target)) {
      const values = items.map(item => this.queryValue(item));
      return [values.map(value => value.text).join(this.querySeparator(values))];
    }
    return items.map(item => this.plainText(item, target));
  }

  private insertQueryItems(target: HTMLInputElement | HTMLTextAreaElement, items: ClipboardItem[]) {
    if (!this.isQueryField(target)) return false;
    const values = items.map(item => this.queryValue(item));
    const separator = this.querySeparator(values);
    this.insertText(target, values.map(value => value.text).join(separator), target.dataset.jasperClipboardReplace === 'true');
    delete target.dataset.jasperClipboardReplace;
    target.dispatchEvent(new CustomEvent('jasper-clipboard-query-paste', { bubbles: true }));
    return true;
  }

  private insertText(target: HTMLInputElement | HTMLTextAreaElement, text: string, replace = false) {
    const start = replace ? 0 : (target.selectionStart ?? target.value.length);
    const end = replace ? target.value.length : (target.selectionEnd ?? target.value.length);
    target.setRangeText(text, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private setInputValue(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private isInteractive(target: HTMLElement | null) {
    if (target?.closest('.clipboard-preview')) return false;
    return !!target?.closest('.clipboard-actions, .clipboard-hold, .clipboard-edit-popup, button, input, textarea, select, a, [contenteditable="true"], [role="button"], [role="link"]');
  }

  private moveBubble(element: HTMLElement, x: number, y: number) {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  private isClipboardEditTarget(target: HTMLElement | null) {
    return !!target?.closest('.clipboard-edit-popup');
  }

  private resetDropState() {
    this.dropDragDepth = 0;
    this.dropVisible = false;
    this.dropActive = false;
  }

  private isDropZoneTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    return !!target.closest('.clipboard-drop-zone');
  }

  private isTagField(target?: HTMLElement) {
    return !!target?.closest('formly-field-tag-input');
  }

  private isEditorField(target?: HTMLElement) {
    return !!target?.closest('app-editor');
  }

  private isQueryField(target?: HTMLElement) {
    return !!target?.closest('.query-editor, .query-field');
  }

  private queryValue(item: ClipboardItem) {
    const text = this.tagOrQueryText(item);
    if (text.startsWith(TAG_URL_PREFIX)) return { text: text.substring(TAG_URL_PREFIX.length), tag: true };
    return { text, tag: false };
  }

  private querySeparator(values: { text: string; tag: boolean }[]) {
    return values.length > 1 && values.every(value => value.tag) ? '|' : '';
  }

  private formatTagText(text: string, prefix: string) {
    if (text.startsWith(TAG_URL_PREFIX)) {
      return prefix + text.substring(TAG_URL_PREFIX.length);
    }
    return text;
  }

  private plainText(item: ClipboardItem, target?: HTMLElement) {
    const text = this.itemText(item);
    if (this.isTagField(target)) return this.formatTagText(this.tagOrQueryText(item), '');
    if (this.isEditorField(target)) return this.editorText(item, text);
    return text;
  }

  private tagOrQueryText(item: ClipboardItem) {
    const text = this.itemText(item);
    return this.stripViewParams(this.normalizeDroppedUrl(item.ref?.url) || this.normalizeDroppedUrl(text) || text);
  }

  private itemText(item: ClipboardItem) {
    if (this.isTagUrl(item.ref?.url)) return item.ref?.url || '';
    return item.text || item.ref?.url || (item.html ? this.stripHtml(item.html) : item.image || '');
  }

  /**
   * Editor pastes prefer markdown: tags become hashtags, images become image
   * embeds, ref-only items become Jasper ref embeds, and other URLs become links.
   */
  private editorText(item: ClipboardItem, text: string) {
    if (text.startsWith(TAG_URL_PREFIX)) return this.formatTagText(text, '#');
    if (item.image && this.safeImage(item.image)) return `![](${this.escapeMarkdownUrl(item.image)})`;
    const url = this.markdownUrl(item, text);
    if (url) {
      if (url.startsWith(TAG_URL_PREFIX)) return this.formatTagText(url, '#');
      const markdownUrl = this.escapeMarkdownUrl(url);
      if (this.isImageUrl(url)) return `![](${markdownUrl})`;
      if (this.isRefEmbedItem(item)) return `![=](${markdownUrl})`;
      return `[${this.escapeMarkdownText(this.markdownLinkTitle(item) || url)}](${markdownUrl})`;
    }
    return text;
  }

  private markdownUrl(item: ClipboardItem, text: string) {
    if (item.ref?.url) return this.normalizeDroppedUrl(item.ref.url);
    return this.isUri(text) ? text : undefined;
  }

  /**
   * Ref-only items come from Jasper Ref actions/copies, while dropped links carry
   * text/html too and should paste as ordinary markdown links.
   */
  private isRefEmbedItem(item: ClipboardItem) {
    return !!item.ref?.url && item.text === undefined && item.html === undefined;
  }

  private markdownLinkTitle(item: ClipboardItem) {
    return item.ref?.title || (item.html ? this.stripHtml(item.html).trim() : '');
  }

  private escapeMarkdownText(text: string) {
    return text.replace(/([\\[\]()])/g, '\\$1');
  }

  private escapeMarkdownUrl(url: string) {
    return url.replace(/[()\s]/g, value => encodeURIComponent(value));
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
    // Copy events may target a container while the selected HTML contains the
    // actual tag/link anchor, so parse the selection as a fallback.
    const ref = this.refFromTarget(target) || (html ? this.refFromHtml(html) : undefined);
    if (!text && !html && !ref) return undefined;
    const itemText = this.isTagUrl(ref?.url) ? ref?.url : text;
    return { text: itemText || undefined, html: html || undefined, ref };
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

  private refFromTarget(target: HTMLElement | null): ClipboardRef | undefined {
    const refEl = target?.closest('.ref[data-ref-url]') as HTMLElement | null;
    const url = refEl?.dataset['refUrl'];
    if (!url) return this.tagRefFromTarget(target);
    return {
      url,
      origin: refEl.dataset['refOrigin'] || undefined,
      title: refEl.dataset['refTitle'] || undefined,
    };
  }

  private tagRefFromTarget(target: HTMLElement | null): ClipboardRef | undefined {
    const tagLink = target?.closest('a[href]') as HTMLAnchorElement | null;
    const url = this.normalizeDroppedUrl(tagLink?.href);
    if (!url || !this.isTagUrl(url)) return undefined;
    return {
      url,
      title: this.cleanTitle(tagLink?.textContent, tagLink?.title, url.substring(TAG_URL_PREFIX.length)),
    };
  }

  private addFromClipboardData(data: DataTransfer | null) {
    this.addFromDataTransfer(data);
  }

  private addFromDataTransfer(data: DataTransfer | null) {
    if (!data) return;
    const text = this.normalizeDroppedTextUri(data.getData('text/plain')) || undefined;
    const html = data.getData('text/html') || undefined;
    const ref = this.refFromDataTransfer(data, html, text);
    const refOnly = !!this.draggedRef && !!ref;
    if (refOnly) {
      this.addItem({ ref });
      return;
    }
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
    if (this.draggedRef) return this.draggedRef;
    const uri = data.getData('text/uri-list').split('\n').find(line => !!line && !line.startsWith('#'));
    const htmlRef = html ? this.refFromHtml(html) : undefined;
    const textUri = text && this.isUri(text) ? text : undefined;
    const url = this.normalizeDroppedUrl(uri || htmlRef?.url || textUri);
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
    if (link) return { url: this.normalizeDroppedUrl(link.href) || link.href, title: this.cleanTitle(link.textContent, link.title) };
    const image = template.content.querySelector('img[src]') as HTMLImageElement | null;
    if (image?.src && this.safeImage(image.src)) return { url: image.src, title: this.cleanTitle(image.alt, image.title) };
    return undefined;
  }

  /**
   * In-app tag links are dragged as page URLs; store them as canonical tag URIs.
   */
  private normalizeDroppedUrl(url?: string) {
    if (!url) return undefined;
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/tag/')) {
        const tag = decodeURIComponent(parsed.pathname.substring('/tag/'.length));
        return `tag:/${tag}${parsed.search}`;
      }
    } catch {
      return url;
    }
    return url;
  }

  private stripViewParams(text: string) {
    try {
      const parsed = new URL(text);
      for (const name of ['filter', 'search', 'sort']) {
        parsed.searchParams.delete(name);
      }
      return parsed.toString();
    } catch {
      return text;
    }
  }

  private cleanTitle(...values: Array<string | null | undefined>) {
    return values.map(value => value?.trim()).find(value => !!value) || undefined;
  }

  private isTagUrl(url?: string) {
    return !!url?.startsWith(TAG_URL_PREFIX);
  }

  private isUri(text: string) {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
  }

  private isImageUrl(text: string) {
    return this.safeImage(text) || /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp)(?:[?#]\S*)?$/i.test(text);
  }

  private normalizeDroppedTextUri(text: string) {
    const trimmed = text.trim();
    if (!this.isUri(trimmed)) return text;
    return this.normalizeDroppedUrl(trimmed) || text;
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
    if (this.loading) return;
    if (!this.store.account.signedIn) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.tags.getResponse('tag:plugin/user/clipboard').pipe(
      catchError(() => of(undefined)),
    ).subscribe(ref => {
      this.loading = false;
      if (!ref) {
        this.pendingRemotePersist = true;
        this.persistRemote();
        return;
      }
      // Local clipboard edits made before the initial load completes win and are
      // flushed after the current save, rather than being overwritten here.
      if (!this.pendingRemotePersist) this.applyRemote(ref);
      this.persistRemote();
    });
  }

  private applyRemote(ref: Ref | RefUpdates) {
    const remoteItems = ref.plugins?.['plugin/user/clipboard']?.items;
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
      comment: typeof ref.comment === 'string' ? ref.comment : undefined,
      published: typeof ref.published === 'string' ? ref.published : undefined,
      modifiedString: typeof ref.modifiedString === 'string' ? ref.modifiedString : undefined,
      tags: this.sanitiseStringArray(ref.tags),
      sources: this.sanitiseStringArray(ref.sources),
      alternateUrls: this.sanitiseStringArray(ref.alternateUrls),
      plugins: ref.plugins && typeof ref.plugins === 'object' && !Array.isArray(ref.plugins) ? ref.plugins : undefined,
    };
  }

  // Keep only string entries when loading optional Ref array fields.
  private sanitiseStringArray(values: unknown) {
    if (!Array.isArray(values)) return undefined;
    return values.filter(value => typeof value === 'string');
  }

  private persist(remote = true) {
    this.persistLocal();
    if (!remote) return;
    this.pendingRemotePersist = true;
    this.persistRemote();
  }

  private persistLocalOnly() {
    this.persistLocal();
  }

  private pluginSetting(key: 'interceptCopy' | 'interceptPaste') {
    const value = this.plugin?.config?.[key];
    const fallback = this.plugin?.defaults?.[key];
    return typeof value === 'boolean' ? value : (typeof fallback === 'boolean' ? fallback : false);
  }

  private refEditForm(ref?: ClipboardRef) {
    const form = refForm(this.fb);
    form.get('url')?.enable();
    if (!ref) return form;
    form.patchValue({
      url: ref.url,
      title: ref.title || '',
      comment: ref.comment || '',
      published: ref.published || '',
      modifiedString: ref.modifiedString || '',
      plugins: ref.plugins || {},
    });
    this.setArray(form.get('tags') as UntypedFormArray, ref.tags || []);
    this.setArray(form.get('sources') as UntypedFormArray, ref.sources || []);
    this.setArray(form.get('alternateUrls') as UntypedFormArray, ref.alternateUrls || []);
    return form;
  }

  private setArray(array: UntypedFormArray, values: string[]) {
    array.clear();
    for (const value of values) array.push(this.fb.control(value));
  }

  private refFromEditForm(existing: ClipboardRef) {
    const value = this.editForm.getRawValue();
    const ref: ClipboardRef = {
      ...existing,
      url: value.url,
      title: value.title || undefined,
      comment: value.comment || undefined,
      published: value.published || undefined,
      modifiedString: value.modifiedString || undefined,
      tags: this.nonEmptyStrings(value.tags),
      sources: this.nonEmptyStrings(value.sources),
      alternateUrls: this.nonEmptyStrings(value.alternateUrls),
      plugins: value.plugins && Object.keys(value.plugins).length ? value.plugins : undefined,
    };
    return ref;
  }

  // Persist non-empty form array strings, omitting empty arrays from the Ref.
  private nonEmptyStrings(values: unknown) {
    if (!Array.isArray(values)) return undefined;
    const strings = values.filter(value => typeof value === 'string' && value.trim());
    return strings.length ? strings : undefined;
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
    if (!this.store.account.signedIn) {
      this.pendingRemotePersist = false;
      return;
    }
    if (this.loading || this.savingRemote || !this.pendingRemotePersist) return;
    this.pendingRemotePersist = false;
    this.savingRemote = true;
    // Remote writes are serialized by savingRemote; keep the in-flight request
    // alive and let the pending flag schedule one save with the newest snapshot.
    this.save = this.tags.mergeResponse(['plugin/user/clipboard'], 'tag:plugin/user/clipboard', {
      'plugin/user/clipboard': {
        items: this.items.map(item => this.serializeRemote(item)),
      },
    }).pipe(
      catchError(() => of(undefined)),
      finalize(() => {
        this.savingRemote = false;
        this.save = undefined;
        // Leave finalize's call stack before starting the queued save.
        if (this.pendingRemotePersist) window.setTimeout(() => this.persistRemote(), 0);
      }),
    ).subscribe();
  }

  private serializeRemote(item: ClipboardItem) {
    return {
      id: item.id,
      created: item.created,
      ...(item.text !== undefined ? { text: item.text } : {}),
      ...(item.html !== undefined ? { html: item.html } : {}),
      ...(item.image !== undefined ? { image: item.image } : {}),
      ...(item.ref ? { ref: this.serializeRemoteRef(item.ref) } : {}),
    };
  }

  private serializeLocal(item: ClipboardItem) {
    return {
      ...this.serializeRemote(item),
      ...(item.ref ? { ref: item.ref } : {}),
      x: item.x,
      y: item.y,
      ...(item.hold ? { hold: true } : {}),
    };
  }

  // Remote plugin data must match refSchema, so omit cursor/local fields such
  // as origin and modifiedString while keeping them in local storage.
  private serializeRemoteRef(ref: ClipboardRef) {
    return {
      url: ref.url,
      ...(ref.title !== undefined ? { title: ref.title } : {}),
      ...(ref.comment !== undefined ? { comment: ref.comment } : {}),
      ...(ref.published !== undefined ? { published: ref.published } : {}),
      ...(ref.tags !== undefined ? { tags: ref.tags } : {}),
      ...(ref.sources !== undefined ? { sources: ref.sources } : {}),
      ...(ref.alternateUrls !== undefined ? { alternateUrls: ref.alternateUrls } : {}),
      ...(ref.plugins !== undefined ? { plugins: ref.plugins } : {}),
    };
  }
}
