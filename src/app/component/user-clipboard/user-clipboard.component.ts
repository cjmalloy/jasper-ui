import { AsyncPipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import DOMPurify from 'dompurify';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, finalize, of, Subscription } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Plugin } from '../../model/plugin';
import { mapRef, Ref, RefUpdates, writeRef } from '../../model/ref';
import { active, Icon, sortOrder, uniqueConfigs } from '../../model/tag';
import { CssUrlPipe } from '../../pipe/css-url.pipe';
import { ThumbnailPipe } from '../../pipe/thumbnail.pipe';
import { AdminService } from '../../service/admin.service';
import { StompService } from '../../service/api/stomp.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { getTitle } from '../../util/format';
import { getScheme } from '../../util/http';
import { EditorService } from '../../service/editor.service';
import { DateTime } from 'luxon';

const BUBBLE_START_X = 12;
const BUBBLE_START_Y = 72;
const BUBBLE_SPACING = 56;
const BUBBLE_COLUMN_SPACING = 288;
const BUBBLE_WIDTH_OFFSET = 64;
const BUBBLE_HEIGHT_OFFSET = 48;
const MAX_PREVIEW_LENGTH = 48;
const PREVIEW_TRUNCATE_AT = 45;
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
  ref?: Ref;
  x: number;
  y: number;
  selected?: boolean;
  hold?: boolean;
}

type ClipboardItemContent = Omit<ClipboardItem, 'id' | 'created' | 'x' | 'y'>;

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
    AsyncPipe,
    CssUrlPipe,
    ThumbnailPipe,
  ],
})
export class UserClipboardComponent implements OnInit, OnDestroy {

  remote?: Ref;
  items: ClipboardItem[] = [];
  private watch?: Subscription;
  private save?: Subscription;
  private drag?: DragState;
  private draggedRef?: Ref;
  private dropDragDepth = 0;
  private suppressedSelect?: ClipboardItem;
  private pendingRemotePersist = false;
  private savingRemote = false;
  private disposers: IReactionDisposer[] = [];
  private resizeClamp?: number;
  private loading = false;
  dropVisible = false;
  dropActive = false;
  dropFilled = false;

  constructor(
    private config: ConfigService,
    public store: Store,
    private admin: AdminService,
    private tags: TaggingService,
    private editor: EditorService,
    private stomp: StompService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadLocal();
    this.loadRemote();
    this.disposers.push(autorun(() => {
      if (this.store.eventBus.event === 'clip' && this.store.eventBus.ref?.url) {
        this.addItem({ ref: this.store.eventBus.ref });
      }
    }));
    this.watch = this.stomp.watchResponse('tag:/plugin/user/clipboard').pipe(
      catchError(() => of(undefined)),
    ).subscribe(() => this.loadRemote());
  }

  ngOnDestroy() {
    this.watch?.unsubscribe();
    this.save?.unsubscribe();
    if (this.resizeClamp) window.clearTimeout(this.resizeClamp);
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get plugin(): Plugin | undefined {
    return this.admin.getPlugin('plugin/user/clipboard');
  }

  get interceptCopy() {
    const value = this.remote?.plugins?.['plugin/user/clipboard']?.interceptCopy;
    if (value !== undefined) return value;
    return this.plugin?.defaults?.interceptCopy;
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

  thumbnailVisible(item: ClipboardItem) {
    return !!item.ref && (
      this.hasThumbnail(item) ||
      !!this.thumbnailEmoji(item) ||
      !!this.thumbnailColor(item)
    );
  }

  thumbnailRefs(item: ClipboardItem) {
    if (!item.ref) return [];
    // TODO: Bare reposts
    return [item.ref];
  }

  thumbnailForce(item: ClipboardItem) {
    return !!item.ref?.tags?.includes('plugin/thumbnail') && !this.thumbnailPlugin(item);
  }

  thumbnailColor(item: ClipboardItem) {
    return this.thumbnailString(item, 'color');
  }

  thumbnailEmoji(item: ClipboardItem) {
    return this.thumbnailString(item, 'emoji') || (this.hasThumbnail(item) ? '' : this.thumbnailDefaultEmoji(item));
  }

  thumbnailLabel(item: ClipboardItem) {
    return $localize`Thumbnail for ${this.preview(item)}`;
  }

  thumbnailRadius(item: ClipboardItem) {
    return this.thumbnailRadiusValue(this.thumbnailPlugin(item)?.['radius']) ?? 0;
  }

  previewText(item: ClipboardItem) {
    if (this.isTagUrl(item.ref?.url)) return item.ref?.title || item.ref?.url?.substring('tag:/'.length) || '';
    if (item.text) return item.text;
    if (item.ref) return getTitle(item.ref);
    if (item.html) return $localize`HTML`;
    return '';
  }

  previewLink(item: ClipboardItem) {
    const url = item.ref?.url;
    if (!url) return '';
    const path = this.router.serializeUrl(this.router.createUrlTree(
      this.isTagUrl(url) ? ['/tag', url.substring('tag:/'.length)] : ['/ref', url],
    ));
    return this.config.base + (path.startsWith('/') ? path.substring(1) : path);
  }

  select(item: ClipboardItem, event: MouseEvent) {
    if (event.button) return;
    if (this.suppressedSelect === item || this.drag?.moved) {
      this.suppressedSelect = undefined;
      return;
    }
    item.selected = !item.selected;
    this.persistLocal();
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
    this.persistLocal();
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
    if (this.dropActive) return;
    if (!this.dropDragDepth) this.resetDropState();
  }

  @HostListener('document:drop', ['$event'])
  documentDrop(event: DragEvent) {
    if (this.isDropZoneTarget(event.target as HTMLElement | null)) return;
    this.resetDropState();
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dropActive = true;
  }

  dragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  drop(event: DragEvent) {
    const file  =Array.from(event.dataTransfer?.items || []).find(item => item.kind === 'file');
    this.resetDropState();
    this.dropFilled = true;
    if (!file && event.dataTransfer) {
      event.preventDefault();
      event.stopPropagation();
      const text = this.normalizeDroppedTextUri(event.dataTransfer.getData('text/plain')) || undefined;
      const html = event.dataTransfer.getData('text/html') || undefined;
      const ref = this.refFromDataTransfer(event.dataTransfer, html, text);
      const refOnly = !!this.draggedRef && !!ref;
      if (refOnly) {
        this.addItem({ ref });
      } else if (text || html || ref) {
        this.addItem({ text, html, ref });
      }
    }
    this.draggedRef = undefined;
    window.setTimeout(() => this.dropFilled = false, 800);
  }

  @HostListener('document:dragstart', ['$event'])
  dragStart(event: DragEvent) {
    this.draggedRef = this.refFromTarget(event.target as HTMLElement | null);
  }

  @HostListener('window:resize')
  resize() {
    if (this.resizeClamp) window.clearTimeout(this.resizeClamp);
    this.resizeClamp = window.setTimeout(() => {
      this.resizeClamp = undefined;
      this.clampBubblePositions();
    }, 100);
  }

  private clampBubblePositions() {
    let changed = false;
    for (const item of this.items) {
      const position = this.clampBubblePosition(item);
      if (position.x === item.x && position.y === item.y) continue;
      item.x = position.x;
      item.y = position.y;
      changed = true;
    }
    if (changed) this.persistLocal();
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
    const { x, y } = this.clampBubblePosition({
      x: event.clientX - this.drag.offsetX,
      y: event.clientY - this.drag.offsetY,
    });
    if (Math.abs(x - this.drag.startX) > 3 || Math.abs(y - this.drag.startY) > 3) this.drag.moved = true;
    this.drag.item.x = x;
    this.drag.item.y = y;
    this.drag.element.style.left = `${x}px`;
    this.drag.element.style.top = `${y}px`;
  }

  pointerUp(event: PointerEvent) {
    if (!this.drag) return;
    const { element, item, moved } = this.drag;
    this.clearPointerCapture(element, event.pointerId);
    this.drag = undefined;
    if (moved) {
      this.suppressedSelect = item;
      this.persistLocal();
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
    const item = this.clipboardItem(event.target, false);
    if (!item) return;
    event.preventDefault();
    this.addItem(item);
  }

  @HostListener('document:paste', ['$event'])
  paste(event: ClipboardEvent) {
    if (!this.interceptCopy) return;
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('document:focusin', ['$event'])
  focusIn(event: FocusEvent) {
    if (!this.hasPendingPaste()) return;
    this.pasteInto(event.target as HTMLElement);
  }

  private addItem(item: ClipboardItemContent) {
    const position = this.bubblePosition(this.items.length);
    this.items = [
      ...this.items,
      {
        id: uuid(),
        created: DateTime.now().toISO(),
        ...position,
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
    this.persistLocal();
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

  private isInteractive(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    if (this.store.hotkey && target.closest('a.clipboard-preview')) return true;
    if (target.closest('.clipboard-preview')) return false;
    return !!target.closest('.clipboard-actions, .clipboard-hold, button, input, textarea, select, a, [contenteditable="true"], [role="button"], [role="link"]');
  }

  private bubblePosition(index: number) {
    const rows = this.maxBubbleRows();
    const column = Math.floor(index / rows);
    const row = index % rows;
    return this.clampBubblePosition({
      x: BUBBLE_START_X + column * BUBBLE_COLUMN_SPACING,
      y: BUBBLE_START_Y + row * BUBBLE_SPACING,
    });
  }

  private clampBubblePosition(position: Pick<ClipboardItem, 'x' | 'y'>) {
    return {
      x: Math.max(0, Math.min(this.maxBubbleX(), position.x)),
      y: Math.max(0, Math.min(this.maxBubbleY(), position.y)),
    };
  }

  private maxBubbleRows() {
    const maxY = this.maxBubbleY();
    return maxY <= BUBBLE_START_Y ? 1 : Math.floor((maxY - BUBBLE_START_Y) / BUBBLE_SPACING) + 1;
  }

  private maxBubbleX() {
    return Math.max(0, window.innerWidth - BUBBLE_WIDTH_OFFSET);
  }

  private maxBubbleY() {
    return Math.max(0, window.innerHeight - BUBBLE_HEIGHT_OFFSET);
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
    return !!target?.closest('.tag-field');
  }

  private isBookmarkField(target?: HTMLElement) {
    return !!target?.closest('.bookmark-field');
  }

  private isEditorField(target?: HTMLElement) {
    return !!target?.closest('app-editor');
  }

  private isQueryField(target?: HTMLElement) {
    return !!target?.closest('.query-editor, .query-field');
  }

  private queryValue(item: ClipboardItem) {
    const text = this.tagOrQueryText(item);
    if (text.startsWith('tag:/')) return { text: text.substring('tag:/'.length), tag: true };
    return { text, tag: false };
  }

  private querySeparator(values: { text: string; tag: boolean }[]) {
    return values.length > 1 && values.every(value => value.tag) ? '|' : '';
  }

  private formatTagText(text: string, prefix: string) {
    if (text.startsWith('tag:/')) {
      return prefix + text.substring('tag:/'.length);
    }
    return text;
  }

  private plainText(item: ClipboardItem, target?: HTMLElement) {
    const text = this.itemText(item);
    if (this.isTagField(target)) return this.formatTagText(this.tagOrQueryText(item), '');
    if (this.isBookmarkField(target)) return this.bookmarkText(item);
    if (this.isEditorField(target)) return this.editorText(item, text);
    return text;
  }

  private bookmarkText(item: ClipboardItem) {
    const text = this.itemText(item);
    const normalized = this.normalizeDroppedUrl(item.ref?.url) || this.normalizeDroppedUrl(text) || text;
    return this.formatTagText(normalized, '');
  }

  private tagOrQueryText(item: ClipboardItem) {
    const text = this.itemText(item);
    return this.stripViewParams(this.normalizeDroppedUrl(item.ref?.url) || this.normalizeDroppedUrl(text) || text);
  }

  private itemText(item: ClipboardItem) {
    if (this.isTagUrl(item.ref?.url)) return item.ref?.url || '';
    return item.text || item.ref?.url || (item.html ? this.stripHtml(item.html) : '');
  }

  /**
   * Editor pastes prefer markdown: tags become hashtags, images become image
   * embeds, ref-only items become Jasper ref embeds, and other URLs become links.
   */
  private editorText(item: ClipboardItem, text: string) {
    if (text.startsWith('tag:/')) return this.formatTagText(text, '#');
    const url = this.markdownUrl(item, text);
    if (url) {
      if (url.startsWith('tag:/')) return this.formatTagText(url, '#');
      const markdownUrl = this.escapeMarkdownUrl(url);
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
    return [document.createTextNode(this.plainText(item))];
  }

  private clipboardItem(target: EventTarget | null, getRef = true): ClipboardItemContent | undefined {
    const text = this.selectedText(target);
    const html = this.selectedHtml();
    const targetRef = getRef ? this.refFromTarget(target) : this.tagRefFromTarget(target);
    const textRef = text && this.isUri(text) ? this.tagRefFromUrl(text) : undefined;
    // Copy events may target a container while the selected HTML contains the
    // actual tag/link anchor, so parse the selection as a fallback.
    const ref = targetRef || (html ? this.refFromHtml(html) : undefined) || textRef;
    if (!text && !html && !ref) return undefined;
    const itemText = this.isTagUrl(ref?.url) ? ref?.url : text;
    return { text: itemText || undefined, html: html || undefined, ref };
  }

  private selectedText(target: EventTarget | null) {
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

  private refFromTarget(target: EventTarget | null): Ref | undefined {
    const element = target instanceof Element ? target : null;
    const refEl = element?.closest('.ref[data-ref-url]') as HTMLElement | null;
    const url = refEl?.dataset['refUrl'];
    if (!url) return this.tagRefFromTarget(target);
    const thumbnail = this.thumbnailEnabled() ? this.thumbnailFromTarget(refEl) : undefined;
    return {
      url,
      origin: refEl.dataset['refOrigin'] || undefined,
      title: refEl.dataset['refTitle'] || undefined,
      ...(thumbnail ? {
        tags: ['plugin/thumbnail'],
        plugins: { 'plugin/thumbnail': thumbnail },
      } : {}),
    };
  }

  private thumbnailFromTarget(refEl: HTMLElement | null) {
    const radiusValue = refEl?.dataset['refThumbnailRadius'];
    const radius = this.thumbnailRadiusValue(radiusValue);
    const thumbnail = {
      ...(refEl?.dataset['refThumbnailUrl'] ? { url: refEl.dataset['refThumbnailUrl'] } : {}),
      ...(refEl?.dataset['refThumbnailColor'] ? { color: refEl.dataset['refThumbnailColor'] } : {}),
      ...(refEl?.dataset['refThumbnailEmoji'] ? { emoji: refEl.dataset['refThumbnailEmoji'] } : {}),
      ...(radius !== undefined && Number.isFinite(radius) ? { radius } : {}),
    };
    return Object.keys(thumbnail).length ? thumbnail : undefined;
  }

  private tagRefFromTarget(target: EventTarget | null): Ref | undefined {
    if (!(target instanceof Element)) return undefined;
    const tagLink = target.closest('a[href]') as HTMLAnchorElement | null;
    return this.tagRefFromUrl(tagLink?.href, tagLink?.textContent, tagLink?.title);
  }

  private tagRefFromUrl(value?: string, ...titles: Array<string | null | undefined>): Ref | undefined {
    const url = this.normalizeDroppedUrl(value);
    if (!url || !this.isTagUrl(url)) return undefined;
    return {
      url,
      title: this.cleanTitle(...titles, this.tagUrlPreview(url)),
    };
  }

  private refFromDataTransfer(data: DataTransfer, html?: string, text?: string): Ref | undefined {
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

  private refFromHtml(html: string): Ref | undefined {
    const template = document.createElement('template');
    template.innerHTML = DOMPurify.sanitize(html, SANITIZE_CONFIG);
    const link = template.content.querySelector('a[href]') as HTMLAnchorElement | null;
    if (link) return { url: this.normalizeDroppedUrl(link.href) || link.href, title: this.cleanTitle(link.textContent, link.title) };
    return undefined;
  }

  /**
   * In-app tag links are dragged as page URLs; store them as canonical tag URIs.
   */
  private normalizeDroppedUrl(url?: string) {
    if (!url) return undefined;
    const type = this.editor.getUrlType(url);
    if (type === 'tag') {
      try {
        const parsed = new URL(url);
        const normalized = parsed.origin + parsed.pathname;
        return 'tag:/' + this.editor.getQuery(normalized) + parsed.search;
      } catch {
        return 'tag:/' + this.editor.getQuery(url);
      }
    }
    if (type === 'ref') return this.editor.getRefUrl(url);
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

  private tagUrlPreview(url: string) {
    return this.stripViewParams(url).substring('tag:/'.length);
  }

  private isTagUrl(url?: string) {
    return !!url?.startsWith('tag:/');
  }

  private isUri(text: string) {
    try {
      new URL(text);
      return true;
    } catch {
      return false;
    }
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
    this.tags.getResponse('tag:/plugin/user/clipboard').pipe(
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
    this.remote = ref;
    const remoteItems = ref.plugins?.['plugin/user/clipboard']?.items;
    if (!Array.isArray(remoteItems)) return;
    this.items = [
      ...this.sanitise(remoteItems, this.items, false),
    ];
    this.persistLocal();
  }

  private sanitise(items: any[], previous: ClipboardItem[] = [], includeItemState = true): ClipboardItem[] {
    const localState = new Map(previous.map(item => [item.id, item]));
    return items
      .map((item, index) => ({
        id: item.id,
        text: item.text,
        html: item.html,
        ref: this.preserveRefOrigin(mapRef(item.ref), localState.get(item.id)?.ref),
        created: item.created || DateTime.now().toISO(),
        ...this.mergeItemState(item, localState.get(item.id), index, includeItemState),
      }));
  }

  private mergeItemState(item: any, local: ClipboardItem | undefined, index: number, includeItemState: boolean) {
    const fallback = local ? { x: local.x, y: local.y } : this.bubblePosition(index);
    const position = this.clampBubblePosition({
      x: includeItemState && typeof item.x === 'number' ? item.x : fallback.x,
      y: includeItemState && typeof item.y === 'number' ? item.y : fallback.y,
    });
    return {
      x: position.x,
      y: position.y,
      hold: includeItemState ? !!item.hold : local?.hold ?? false,
      selected: local?.selected,
    };
  }

  private preserveRefOrigin(ref: Ref | undefined, local: Ref | undefined) {
    if (!ref) return undefined;
    return {
      ...ref,
      origin: ref.origin ?? local?.origin,
    };
  }

  private thumbnailPlugin(item: ClipboardItem) {
    if (!this.thumbnailEnabled()) return undefined;
    return this.thumbnailObject(item.ref?.plugins?.['plugin/thumbnail']);
  }

  private hasThumbnail(item: ClipboardItem) {
    return this.thumbnailEnabled() && !!item.ref && this.hasRefThumbnail(item.ref, item.ref.plugins);
  }

  private hasRefThumbnail(ref: Ref, plugins = ref.plugins) {
    const thumbnail = this.thumbnailObject(plugins?.['plugin/thumbnail']);
    return !!ref.tags?.includes('plugin/thumbnail') ||
      this.hasThumbnailValue(thumbnail, 'url') ||
      this.hasThumbnailValue(thumbnail, 'color') ||
      this.hasThumbnailValue(thumbnail, 'emoji') ||
      this.hasPluginThumbnailUrl(plugins, 'plugin/image') ||
      this.hasPluginThumbnailUrl(plugins, 'plugin/video');
  }

  private hasPluginThumbnailUrl(plugins: Record<string, unknown> | undefined, plugin: 'plugin/image' | 'plugin/video') {
    const value = this.thumbnailObject(plugins?.[plugin])?.['url'];
    return typeof value === 'string' && !!value;
  }

  private hasThumbnailValue(thumbnail: Record<string, unknown> | undefined, key: 'url' | 'color' | 'emoji') {
    const value = thumbnail?.[key];
    return typeof value === 'string' && !!value;
  }

  private thumbnailDefaultEmoji(item: ClipboardItem) {
    return this.thumbnailEnabled() && item.ref ? this.defaultThumbnailEmoji(item.ref) : '';
  }

  private thumbnailEnabled() {
    return !!this.admin.getPlugin('plugin/thumbnail');
  }

  private defaultThumbnailEmoji(ref: Ref) {
    const icon = uniqueConfigs(sortOrder(this.admin.getIcons(ref.tags, ref.plugins, getScheme(ref.url))))
      .find(icon => this.isDefaultThumbnailIcon(icon) && active(ref, icon));
    return icon?.label || icon?.thumbnail || '';
  }

  private isDefaultThumbnailIcon(icon: Icon) {
    return !!icon.thumbnail || (!!icon.label && (icon.order || 0) >= 0);
  }

  private thumbnailString(item: ClipboardItem, key: 'color' | 'emoji') {
    const value = this.thumbnailPlugin(item)?.[key];
    return typeof value === 'string' ? value : '';
  }

  private thumbnailObject(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  }

  private thumbnailRadiusValue(value: unknown) {
    if (value === undefined || value === null || value === '') return undefined;
    const radius = Number(value);
    return Number.isFinite(radius) ? radius : undefined;
  }

  private persist(remote = true) {
    this.persistLocal();
    if (!remote) return;
    this.pendingRemotePersist = true;
    this.persistRemote();
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
    const items = this.items.flatMap(item => {
      const remote = this.serializeRemote(item);
      return remote ? [remote] : [];
    });
    this.save = this.tags.mergeResponse(['plugin/user/clipboard'], 'tag:/plugin/user/clipboard', {
      'plugin/user/clipboard': {
        items,
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
      ...(item.text ? { text: item.text } : {}),
      ...(item.html ? { html: item.html } : {}),
      ...(item.ref ? { ref: this.serializeRef(item.ref) } : {}),
    };
  }

  private serializeLocal(item: ClipboardItem) {
    return {
      ...(this.serializeRemote(item)),
      x: item.x,
      y: item.y,
      ...(item.hold ? { hold: true } : {}),
    };
  }

  private serializeRef(ref: Ref) {
    return {
      url: ref.url,
      origin: ref.origin,
      ...(ref.title ? { title: ref.title } : {}),
      ...(ref.comment ? { comment: ref.comment } : {}),
      ...(ref.published ? { published: ref.published.toISO() } : {}),
      ...(ref.tags ? { tags: ref.tags } : {}),
      ...(ref.sources ? { sources: ref.sources } : {}),
      ...(ref.alternateUrls ? { alternateUrls: ref.alternateUrls } : {}),
      ...(ref.plugins ? { plugins: ref.plugins } : {}),
      ...(ref.metadata ? { metadata: ref.metadata } : {}),
    };
  }
}
