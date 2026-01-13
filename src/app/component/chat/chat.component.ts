import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { HttpEventType } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { debounce, defer, delay, pull, pullAllWith, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, last, map, Observable, of, Subject, Subscription, switchMap, takeUntil, tap, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { AutofocusDirective } from '../../directive/autofocus.directive';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ref } from '../../model/ref';
import { EditorButton, sortOrder } from '../../model/tag';
import { mimeToCode } from '../../mods/code';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { TaggingService } from '../../service/api/tagging.service';
import { AuthzService } from '../../service/authz.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { Store } from '../../store/store';
import { readFileAsDataURL, readFileAsString } from '../../util/async';
import { URI_REGEX } from '../../util/format';
import { fixUrl } from '../../util/http';
import { getArgs } from '../../util/query';
import { braces, hasTag, tagOrigin } from '../../util/tag';
import { LoadingComponent } from '../loading/loading.component';
import { ChatEntryComponent } from './chat-entry/chat-entry.component';

export interface ChatUpload {
  id: string;
  name: string;
  progress: number;
  subscription?: Subscription;
  completed?: boolean;
  error?: string;
  ref?: Ref | null;
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  host: { 'class': 'chat ext' },
  imports: [
    ChatEntryComponent,
    LoadingComponent,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    ReactiveFormsModule,
    AutofocusDirective,
  ],
})
export class ChatComponent implements OnDestroy, OnChanges, HasChanges {
  private destroy$ = new Subject<void>();
  itemSize = 18.5;

  @Input()
  query = 'chat';
  @Input()
  responseOf?: Ref;

  @ViewChild(CdkVirtualScrollViewport)
  viewport!: CdkVirtualScrollViewport;

  cursors = new Map<string, string | undefined>();
  loadingPrev = false;
  plugins = this.store.account.defaultEditors(['plugin/latex']);
  lastPoll = DateTime.now();
  initialSize = 50;
  messages?: Ref[];
  addText = '';
  sending: Ref[] = [];
  errored: Ref[] = [];
  scrollLock?: number;
  uploads: ChatUpload[] = [];
  dropping = false;

  latex = !!this.admin.getPlugin('plugin/latex');

  private tags: string[] = [];
  private timeoutId?: number;
  private retries = 0;
  private lastScrolled = 0;
  private watch?: Subscription;

  constructor(
    public config: ConfigService,
    private accounts: AccountService,
    public admin: AdminService,
    private store: Store,
    private auth: AuthzService,
    private refs: RefService,
    private editor: EditorService,
    private stomp: StompService,
    private proxy: ProxyService,
    private ts: TaggingService,
  ) { }

  saveChanges() {
    //TODO:
    return true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.query || changes.responseOf) {
      this.init();
    }
  }

  ngOnDestroy(): void {
    this.clearPoll();
    this.destroy$.next();
    this.destroy$.complete();
    // Clean up any active upload subscriptions to prevent memory leaks
    this.uploads.forEach(upload => {
      if (upload.subscription) {
        upload.subscription.unsubscribe();
      }
    });
  }

  init() {
    this.messages = undefined;
    this.cursors.clear();
    this.tags = this.store.account.defaultEditors(this.editors);
    this.loadPrev(true);
    if (this.config.websockets) {
      this.watch?.unsubscribe();
      this.watch = this.stomp.watchTag(this.query).pipe(
        takeUntil(this.destroy$),
      ).subscribe(tag =>  this.refresh(tagOrigin(tag)));
    }
  }

  get editors() {
    return this.editorButtons.map(p => p?.toggle as string).filter(p => !!p);
  }

  get editorButtons() {
    return sortOrder(this.admin.getEditorButtons()).reverse();
  }

  get editorPushButtons() {
    return this.editorButtons.filter(b => !b.ribbon && this.visible(b));
  }

  visible(button: EditorButton) {
    if (button.scheme) return false;
    if (!button.global) return false;
    if (button.toggle && !this.auth.canAddTag(button.toggle)) return false;
    return true;
  }

  get containerHeight() {
    return Math.max(300, Math.min(window.innerHeight - 400, this.itemSize * (this.messages?.length || 1)));
  }

  refresh = debounce((origin?: string) => {
    if (origin === undefined) {
      for (const origin of this.cursors.keys()) {
        this.loadMore(origin);
      }
    } else {
      this.loadMore(origin);
    }
  }, 400);

  loadMore(origin: string) {
    this.clearPoll();
    if (!this.cursors.has(origin!)) {
      this.loadPrev(true);
      return;
    }
    this.lastPoll = DateTime.now();
    const query = braces(this.query) + ':' + (origin || '@');
    this.refs.page({
      ...getArgs(
        query,
        'modified,ASC',
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      ),
      responses: this.responseOf?.url,
      modifiedAfter: this.cursors.get(origin!)
    }).pipe(
      catchError(err => {
        this.setPoll(true);
        this.messages ||= [];
        return throwError(() => err);
      }),
      takeUntil(this.destroy$),
    ).subscribe(page => {
      this.setPoll(!page.content.length);
      this.messages ||= [];
      if (!page.content.length) return;
      this.messages = [...this.messages, ...page.content];
      const last = page.content[page.content.length - 1];
      this.cursors.set(origin, last?.modifiedString);
      // TODO: verify read before clearing?
      this.accounts.clearNotificationsIfNone(last.modified);
      pullAllWith(this.sending, page.content, (a, b) => a.url === b.url);
      defer(() => this.viewport.checkViewportSize());
      if (!this.scrollLock) this.scrollDown();
    });
  }

  loadPrev(scrollDown = false) {
    if (this.loadingPrev) return;
    this.loadingPrev = true;
    this.lastPoll = DateTime.now();
    this.refs.page({
      ...getArgs(
        this.query,
        'modified,DESC',
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        Math.max(this.store.view.pageSize, !this.cursors.size ? this.initialSize : 0),
      ),
      responses: this.responseOf?.url,
      modifiedBefore: this.messages?.[0]?.modifiedString,
    }).pipe(
      catchError(err => {
        this.loadingPrev = false;
        this.messages ||= [];
        this.setPoll(true);
        return throwError(() => err);
      }),
      takeUntil(this.destroy$),
    ).subscribe(page => {
      this.loadingPrev = false;
      this.setPoll(!page.content.length);
      this.messages ||= [];
      this.scrollLock = undefined;
      if (!page.content.length) return;
      for (const ref of page.content) {
        if (!this.cursors.has(ref.origin!)) {
          this.cursors.set(ref.origin!, ref.modifiedString);
        }
      }
      this.messages = [...page.content.reverse(), ...this.messages];
      pullAllWith(this.sending, page.content, (a, b) => a.url === b.url);
      defer(() => this.viewport.checkViewportSize());
      if (scrollDown) {
        this.retries = 0;
        this.scrollDown();
      } else {
        this.viewport.scrollToIndex(0, 'smooth');
      }
    });
  }

  scrollDown() {
    defer(() => {
      let wait = 0;
      if (this.lastScrolled < this.messages!.length / 2) {
        this.lastScrolled = Math.floor((this.lastScrolled + this.messages!.length) / 2);
        this.viewport.scrollToIndex(this.lastScrolled, 'smooth');
        wait += 400;
      }
      if (this.lastScrolled < this.messages!.length - 1) {
        this.lastScrolled = this.messages!.length - 1;
        delay(() => this.viewport.scrollToIndex(this.lastScrolled, 'smooth'), wait);
      }
    });
  }

  fetch() {
    if (!this.watch) {
      this.setPoll(false);
    }
  }

  clearPoll() {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId)
      this.timeoutId = undefined;
    }
  }

  setPoll(backoff: boolean) {
    this.clearPoll();
    if (this.watch) return;
    if (backoff) {
      this.retries++;
    } else {
      this.retries = 0;
    }
    this.timeoutId = window.setTimeout(() => this.refresh(),
      // 1 second to ~4 minutes in 10 steps
      Math.max(1000, 250 * Math.pow(2, Math.min(10, this.retries))));
  }

  add() {
    this.addText = this.addText.trim();
    if (!this.addText) return;
    this.scrollLock = undefined;
    const newTags = uniq([
      'internal',
      ...this.tags,
      ...([this.store.view.localTag || 'chat', ...this.store.view.ext?.config?.addTags || []]),
      ...this.plugins,
      ...(this.latex ? ['plugin/latex'] : []),
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
    ]).filter(t => !!t);
    const ref: Ref = URI_REGEX.test(this.addText) ? {
      url: this.editor.getRefUrl(this.addText),
      origin: this.store.account.origin,
      tags: newTags,
    } : {
      url: 'comment:' + uuid(),
      origin: this.store.account.origin,
      comment: this.addText,
      tags: newTags,
    };
    this.addText = '';
    this.send(ref);
  }

  private send(ref: Ref) {
    if (this.responseOf) ref.sources = [this.responseOf.url];
    this.sending.push(ref);
    this.refs.create(ref).pipe(
      map(() => ref),
      catchError(err => {
        if (err.status === 409) {
          // Ref already exists, repost
          return this.refs.create({
            ...ref,
            url: 'comment:' + uuid(),
            tags: [...ref.tags!, 'plugin/repost'],
            sources: [ ref.url, ...ref.sources || [] ],
          });
        } else {
          pull(this.sending, ref);
          this.errored.push(ref);
        }
        return throwError(err);
      }),
    ).subscribe(cursor => {
      this.fetch();
    });
  }

  retry(ref: Ref) {
    pull(this.errored, ref);
    this.send(ref);
  }

  onScroll(index: number) {
    if (!this.scrollLock) return;
    // TODO: count height in rows
    const diff = this.scrollLock - index;
    if (diff < -5) {
      this.scrollLock = undefined;
    }
  }

  toggleTag(button: EditorButton) {
    const tag = button.toggle!;
    if (this.buttonOn(tag)) {
      if (this.tags.includes(tag)) this.tags.splice(this.tags.indexOf(tag), 1);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.removeConfigArray$('editors', tag).subscribe();
      }
    } else {
      this.tags.push(tag);
      if (button.remember && this.admin.getTemplate('user')) {
        this.accounts.addConfigArray$('editors', tag).subscribe();
      }
    }
    if ('vibrate' in navigator) navigator.vibrate([2, 8, 8]);
  }

  buttonOn(tag: string) {
    return this.tags?.includes(tag);
  }

  handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    // First, check for files
    const files = [] as File[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    // If files found and plugin/file is enabled, upload them
    if (files.length && this.admin.getPlugin('plugin/file')) {
      event.preventDefault();
      event.stopPropagation();
      this.upload(files);
      return;
    }
    
    // Check for URL in text content
    const text = event.clipboardData?.getData('text/plain')?.trim();
    if (!text) return;
    
    const isUrl = URI_REGEX.test(text) && this.config.allowedSchemes.filter(s => text.startsWith(s)).length;
    if (isUrl) {
      event.preventDefault();
      event.stopPropagation();
      this.submitUrl(text);
    }
  }

  handleDrop(event: DragEvent) {
    this.dropping = false;
    const items = event.dataTransfer?.items;
    if (!items) return;
    
    // Check for files first
    const files = [] as File[];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item?.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    // If files found and plugin/file is enabled, upload them
    if (files.length && this.admin.getPlugin('plugin/file')) {
      event.preventDefault();
      event.stopPropagation();
      this.upload(files);
      return;
    }
    
    // Check for URL in text content
    const text = event.dataTransfer?.getData('text/plain')?.trim();
    if (!text) return;
    
    const isUrl = URI_REGEX.test(text) && this.config.allowedSchemes.filter(s => text.startsWith(s)).length;
    if (isUrl) {
      event.preventDefault();
      event.stopPropagation();
      this.submitUrl(text);
    }
  }

  dragLeave(event: DragEvent) {
    const target = event.target as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;
    // Only set dropping to false if we're leaving the container entirely
    if (this.dropping && (!relatedTarget || !target.contains(relatedTarget))) {
      this.dropping = false;
    }
  }

  submitUrl(text: string) {
    const newTags = uniq([
      'internal',
      ...this.tags,
      ...([this.store.view.localTag || 'chat', ...this.store.view.ext?.config?.addTags || []]),
      ...this.plugins,
      ...(this.latex ? ['plugin/latex'] : []),
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
    ]).filter(t => !!t);

    const ref: Ref = {
      url: fixUrl(text, this.admin.getTemplate('config/banlist') || this.admin.def.templates['config/banlist']),
      origin: this.store.account.origin,
      tags: newTags,
    };
    
    // Add plugins for the URL
    ref.tags = uniq([...(ref.tags || []), ...this.admin.getPluginsForUrl(ref.url).map(p => p.tag)]);
    
    this.send(ref);
  }

  upload(files: File[]) {
    if (!files || files.length === 0) return;
    files.forEach((file) => {
      const upload: ChatUpload = {
        id: uuid(),
        name: file.name,
        progress: 0
      };
      this.uploads.push(upload);
      
      upload.subscription = this.upload$(file, upload).subscribe(ref => {
        if (ref && !upload.error) {
          upload.completed = true;
          upload.progress = 100;
          upload.ref = ref;
          // Immediately send the file to chat
          this.sendFile(ref);
          // Remove successful upload immediately after sending
          this.uploads = this.uploads.filter(u => u.id !== upload.id);
        }
      });
    });
  }

  upload$(file: File, upload: ChatUpload): Observable<Ref | null> {
    const codeType = mimeToCode(file.type);
    if (codeType.length) {
      const ref: Ref = {
        origin: this.store.account.origin,
        url: 'internal:' + uuid(),
        // Upload as private - only localTag and internal, no visibility tags
        tags: uniq([
          this.store.account.localTag,
          'internal',
          ...file.type === 'text/markdown' ? [] : codeType
        ])
      };
      upload.progress = 50; // Simulate progress for text files
      return readFileAsString(file).pipe(
        switchMap(contents => this.refs.create({
          ...ref,
          comment: contents,
        })),
        map(cursor => {
          ref.modifiedString = cursor;
          ref.modified = DateTime.fromISO(cursor);
          return ref;
        }),
        tap(() => upload.progress = 100),
        catchError(err => {
          upload.error = err.message || $localize`Upload failed`;
          upload.progress = 0;
          return readFileAsDataURL(file).pipe(map(url => ({ 
            ...ref, 
            url,
          } as Ref)));
        }),
      );
    } else {
      // Upload binary files as private - only plugin/file and type-specific tags
      const tags: string[] = ['plugin/file'];
      if (file.type.startsWith('audio/') && this.admin.getPlugin('plugin/audio')) {
        tags.push('plugin/audio');
      } else if (file.type.startsWith('video/') && this.admin.getPlugin('plugin/video')) {
        tags.push('plugin/video', 'plugin/thumbnail');
      } else if (file.type.startsWith('image/') && this.admin.getPlugin('plugin/image')) {
        tags.push('plugin/image', 'plugin/thumbnail');
      } else if (file.type.startsWith('application/pdf') && this.admin.getPlugin('plugin/pdf')) {
        tags.push('plugin/pdf');
      }
      return this.proxy.save(file, this.store.account.origin).pipe(
        map(event => {
          switch (event.type) {
            case HttpEventType.Response:
              return event.body;
            case HttpEventType.UploadProgress:
              const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
              upload.progress = percentDone;
              return null;
          }
          return null;
        }),
        last(),
        switchMap(ref => !ref ? of(ref) : this.ts.patch(tags, ref.url, ref.origin).pipe(
          map(cursor => ({ 
            ...ref, 
            tags: uniq([...ref?.tags || [], ...tags]),
            modifiedString: cursor,
            modified: DateTime.fromISO(cursor),
          })),
        )),
        catchError(err => {
          upload.error = err.message || $localize`Upload failed`;
          upload.progress = 0;
          return readFileAsDataURL(file).pipe(map(url => ({ 
            url, 
            tags, 
            origin: this.store.account.origin 
          } as Ref)));
        }),
      );
    }
  }

  sendFile(ref: Ref) {
    // Add chat tags to the uploaded file ref
    const newTags = uniq([
      'internal',
      ...this.tags,
      ...([this.store.view.localTag || 'chat', ...this.store.view.ext?.config?.addTags || []]),
      ...this.plugins,
      ...(this.latex ? ['plugin/latex'] : []),
      ...(this.store.account.localTag ? [this.store.account.localTag] : []),
      ...(ref.tags || []),
    ]).filter(t => !!t);

    // Update the ref with chat tags
    const chatRef: Ref = {
      ...ref,
      tags: newTags,
      title: undefined,
    };
    
    // Patch the existing ref with chat tags instead of creating a new one
    if (this.responseOf) chatRef.sources = [this.responseOf.url];
    this.sending.push(chatRef);
    this.ts.patch(newTags, chatRef.url, chatRef.origin).pipe(
      catchError(err => {
        pull(this.sending, chatRef);
        this.errored.push(chatRef);
        return throwError(err);
      }),
    ).subscribe(() => {
      this.fetch();
    });
  }

  cancelUpload(upload: ChatUpload) {
    if (upload.subscription) {
      upload.subscription.unsubscribe();
    }
    this.uploads = this.uploads.filter(u => u.id !== upload.id);
  }

  cancelAllUploads() {
    this.uploads.forEach(upload => {
      if (upload.subscription) {
        upload.subscription.unsubscribe();
      }
    });
    this.uploads = [];
  }

  hasActiveUploads(): boolean {
    return this.uploads.some(u => !u.completed && !u.error);
  }

}
