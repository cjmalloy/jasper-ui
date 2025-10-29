import { CdkDrag } from '@angular/cdk/drag-drop';
import { HttpEventType } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { isEqual, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, last, map, Observable, of, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref, RefSort } from '../../../model/ref';
import { mimeToCode } from '../../../mods/code';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { ConfigService } from '../../../service/config.service';
import { OembedStore } from '../../../store/oembed';
import { Store } from '../../../store/store';
import { readFileAsDataURL, readFileAsString } from '../../../util/async';
import { URI_REGEX } from '../../../util/format';
import { fixUrl, printError } from '../../../util/http';
import { getArgs, UrlFilter } from '../../../util/query';
import { hasTag } from '../../../util/tag';
import { LoadingComponent } from '../../loading/loading.component';
import { KanbanCardComponent } from '../kanban-card/kanban-card.component';
import { KanbanDrag } from '../kanban.component';

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss'],
  host: { 'class': 'kanban-column' },
  imports: [
    KanbanCardComponent,
    CdkDrag,
    LoadingComponent,
    ReactiveFormsModule,
  ],
})
export class KanbanColumnComponent implements AfterViewInit, OnChanges, OnDestroy, HasChanges {
  private destroy$ = new Subject<void>();

  @Input()
  query = '';
  @Input()
  hideSwimLanes = true;
  @Input()
  updates?: Observable<KanbanDrag>;
  @Input()
  addTags: string[] = [];
  @Input()
  ext?: Ext;
  @Input()
  size = 8;
  @Input()
  sort: RefSort[] = [];
  @Input()
  filter: UrlFilter[] = [];
  @Input()
  search = '';

  page?: Page<Ref>;
  mutated = false;
  addText = '';
  pressToUnlock = false;
  adding: string[] = [];
  failed: { text: string; error: string }[] = [];
  dropping = false;
  uploadProgress = new Map<string, number>();

  private currentRequest?: Subscription;
  private runningSources?: Subscription;
  private runningResponses?: Subscription;
  private _sort: RefSort[] = [];
  private _filter: UrlFilter[] = [];

  constructor(
    public config: ConfigService,
    private accounts: AccountService,
    private admin: AdminService,
    private store: Store,
    private oembeds: OembedStore,
    private refs: RefService,
    private tags: TaggingService,
    private zone: NgZone,
    private proxy: ProxyService,
  ) {
    if (config.mobile) {
      this.pressToUnlock = true;
    }
  }

  ngAfterViewInit(): void {
    this.updates?.pipe(
      takeUntil(this.destroy$),
    ).subscribe(event => this.update(event));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.query
      || changes.size
      // TODO: why is sort.previousValue overwritten?
      || changes.sort && !isEqual(changes.sort.currentValue, this._sort)
      || changes.filter && !isEqual(changes.filter.currentValue, this._filter)) {
      this.clear()
    } else if (changes.search) {
      this.clear(false)
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostBinding('class.empty')
  get empty() {
    return !this.page?.content.length;
  }

  get more() {
    if (!this.page) return 0;
    return this.page.page.totalElements - this.page.content.length;
  }

  get hasMore() {
    if (!this.page) return false;
    return this.page.page.number < this.page.page.totalPages - 1;
  }

  @HostListener('touchstart', ['$event'])
  touchstart(e: TouchEvent) {
    this.zone.run(() => this.pressToUnlock = true);
  }

  @HostListener('contextmenu', ['$event'])
  contextmenu(event: MouseEvent) {
    if (this.pressToUnlock) event.preventDefault();
  }

  clear(removeCurrent = true) {
    this._sort = [...this.sort];
    this._filter = [...this.filter];
    if (removeCurrent) delete this.page;
    const args = getArgs(
      this.query,
      this.sort,
      this.filter,
      this.search,
      0,
      this.size,
    );
    this.currentRequest?.unsubscribe();
    this.currentRequest = this.refs.page(args).pipe(
      takeUntil(this.destroy$)
    ).subscribe(page => {
      this.page = page;
      this.runningSources?.unsubscribe();
      if (args.sources) {
        this.runningSources = this.refs.page({ ...args, url: args.sources, size: 1, sources: undefined, responses: undefined }).pipe(
          takeUntil(this.destroy$)
        ).subscribe(res => {
          if (res.content[0]) {
            this.mutated = true;
            // @ts-ignore
            res.content[0]['pinned'] = true
            page.content.unshift(res.content[0]);
          }
        });
      }
      this.runningResponses?.unsubscribe();
      if (args.responses) {
        this.runningResponses = this.refs.page({ ...args, url: args.responses, size: 1, sources: undefined, responses: undefined }).pipe(
          takeUntil(this.destroy$)
        ).subscribe(res => {
          if (res.content[0]) {
            this.mutated = true;
            // @ts-ignore
            res.content[0]['pinned'] = true
            page.content.unshift(res.content[0]);
          }
        });
      }
    });
  }

  update(event: KanbanDrag) {
    if (!this.page) return;
    if (event.from === this.query) {
      if (this.page.content.includes(event.ref)) {
        this.mutated ||= event.from !== event.to;
        this.page.page.totalElements--;
        this.page.content.splice(this.page.content.indexOf(event.ref), 1);
      }
    }
    if (event.to === this.query) {
      this.mutated ||= event.from !== event.to;
      this.page.page.totalElements++;
      this.page.content.splice(Math.min(event.index, this.page.content.length - 1), 0, event.ref);
    }
  }

  copy(ref: Ref) {
    if (!this.page) return;
    const index = this.page.content.findIndex(r => r.url === ref.url);
    if (index < 0) return;
    this.page.content.splice(index, 1, ref);
  }

  loadMore() {
    const pinned: Ref[] = [];
    const pageNumber = this.page?.page.number || 0;
    if (this.page && this.mutated) {
      // @ts-ignore
      pinned.push(...this.page.content.filter(r => r['pinned']));
      for (let i = 0; i <= pageNumber; i++) {
        this.refreshPage(i);
      }
    }
    this.mutated = false;
    this.refreshPage(pageNumber + 1, pinned);
  }

  add() {
    // TODO: Move to util function
    this.addText = this.addText.trim();
    if (!this.addText) return;
    const text = this.addText;
    this.addText = '';
    this.adding.push(text);
    const tagsWithAuthor = this.getTagsWithAuthor();
    const isUrl = URI_REGEX.test(text) && this.config.allowedSchemes.filter(s => text.startsWith(s)).length;
    // TODO: support local urls
    const ref: Ref = isUrl ? {
      url: fixUrl(text, this.admin.getTemplate('banlist') || this.admin.def.templates.banlist),
      origin: this.store.account.origin,
      tags: [...tagsWithAuthor],
    } : {
      url: 'comment:' + uuid(),
      origin: this.store.account.origin,
      title: text,
      tags: [...tagsWithAuthor],
    };
    this.oembeds.get(ref.url).pipe(
      tap(oembed => {
        ref.tags ||= [];
        if (oembed) {
          if (oembed.title) {
            ref.title = oembed.title;
          }
          if (oembed.thumbnail_url) {
            ref.tags.push('plugin/thumbnail');
            ref.plugins ||= {};
            ref.plugins['plugin/thumbnail'] = { url: oembed.thumbnail_url };
          }
          if (oembed.url && oembed.type === 'photo') {
            // Image embed
            ref.tags.push('plugin/image');
            ref.tags.push('plugin/thumbnail');
            ref.plugins ||= {};
            ref.plugins['plugin/image'] = { url: oembed.url };
          } else {
            ref.title = oembed.title;
            ref.tags.push('plugin/embed');
          }
        } else {
          ref.tags.push(...this.admin.getPluginsForUrl(ref.url).map(p => p.tag));
        }
        ref.tags = uniq(ref.tags);
      }),
      switchMap(() => this.refs.create(ref)),
      tap(() => {
        if (this.admin.getPlugin('plugin/user/vote/up')) {
          this.tags.createResponse('plugin/user/vote/up', ref.url);
        }
      }),
      catchError(err => {
        if (err.status === 403) {
          // Can't edit Ref, repost it
          return this.repost$(ref.url, tagsWithAuthor);
        }
        if (err.status === 409) {
          // Ref already exists, just tag it
          return this.tags.patch(this.addTags, ref.url, ref.origin).pipe(
            catchError(err => {
              if (err.status === 403) {
                // Can't edit Ref, repost it
                return this.repost$(ref.url, tagsWithAuthor);
              }
              return throwError(err);
            }),
          );
        }
        this.adding.splice(this.adding.indexOf(text), 1);
        this.failed.push({ text, error: printError(err).join('\n') });
        return throwError(err);
      }),
      tap(cursor => this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor))),
    ).subscribe(cursor => {
      this.mutated = true;
      this.adding.splice(this.adding.indexOf(text), 1);
      if (!this.page) {
        console.error('Should not happen, will probably get cleared.');
        this.page = {content: []} as any;
      }
      ref.modified = DateTime.fromISO(cursor);
      ref.modifiedString = cursor;
      this.page!.content.push(ref)
    });
  }

  retry(failedItem: { text: string; error: string }) {
    this.failed.splice(this.failed.indexOf(failedItem), 1);
    this.addText = failedItem.text;
    this.add();
  }

  dismissFailed(failedItem: { text: string; error: string }) {
    this.failed.splice(this.failed.indexOf(failedItem), 1);
  }

  private getTagsWithAuthor(): string[] {
    return !hasTag(this.store.account.localTag, this.addTags) 
      ? [...this.addTags, this.store.account.localTag] 
      : this.addTags;
  }

  handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    if (files.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      this.uploadFiles(files);
    }
  }

  handleDrop(event: DragEvent) {
    this.dropping = false;
    const items = event.dataTransfer?.items;
    if (!items) return;
    
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    if (files.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      this.uploadFiles(files);
    }
  }

  dragLeave(parent: HTMLElement, target: HTMLElement) {
    if (this.dropping && (parent === target || !parent.contains(target))) {
      this.dropping = false;
    }
  }

  uploadFiles(files: File[]) {
    if (!files.length) return;
    if (!this.admin.getPlugin('plugin/file')) return;
    
    files.forEach(file => {
      const fileName = file.name;
      this.adding.push(fileName);
      this.uploadProgress.set(fileName, 0);
      
      this.uploadFile$(file, fileName).subscribe({
        next: ref => {
          if (ref) {
            this.submitUpload(ref, fileName);
          }
        },
        error: err => {
          this.adding.splice(this.adding.indexOf(fileName), 1);
          this.uploadProgress.delete(fileName);
          this.failed.push({ text: fileName, error: printError(err).join('\n') });
        }
      });
    });
  }

  uploadFile$(file: File, fileName: string): Observable<Ref | null> {
    const tagsWithAuthor = this.getTagsWithAuthor();
    
    const codeType = mimeToCode(file.type);
    if (codeType.length) {
      const ref: Ref = {
        origin: this.store.account.origin,
        url: 'internal:' + uuid(),
        title: file.name,
        tags: [...tagsWithAuthor, 'internal', ...file.type === 'text/markdown' ? [] : codeType]
      };
      this.uploadProgress.set(fileName, 50);
      return readFileAsString(file).pipe(
        switchMap(contents => this.refs.create({
          ...ref,
          comment: contents,
        })),
        map(() => ref),
        tap(() => this.uploadProgress.set(fileName, 100)),
        catchError(err => {
          console.warn('File upload failed, falling back to base64 encoding:', err);
          return readFileAsDataURL(file).pipe(map(url => ({ ...ref, url }))); // base64
        }),
      );
    } else {
      const tags: string[] = [...tagsWithAuthor, 'plugin/file'];
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
              this.uploadProgress.set(fileName, percentDone);
              return null;
          }
          return null;
        }),
        last(),
        switchMap(ref => !ref ? of(ref) : this.tags.patch(tags, ref.url, ref.origin).pipe(
          map(cursor => ({ ...ref, tags: uniq([...ref?.tags || [], ...tags]) })),
        )),
        catchError(err => {
          console.warn('File upload failed, falling back to base64 encoding:', err);
          return readFileAsDataURL(file).pipe(map(url => ({ url, tags }))); // base64
        }),
      );
    }
  }

  submitUpload(ref: Ref, fileName: string) {
    if (!this.page) {
      // Initialize page if it doesn't exist yet
      this.page = { content: [], page: { totalElements: 0, number: 0, totalPages: 0, size: 0 } } as Page<Ref>;
    }
    
    ref.origin = this.store.account.origin;
    
    this.mutated = true;
    this.adding.splice(this.adding.indexOf(fileName), 1);
    this.uploadProgress.delete(fileName);
    this.page!.content.push(ref);
  }

  private refreshPage(i: number, pinned?: Ref[]) {
    this.refs.page(getArgs(
      this.query,
      this.sort,
      this.filter,
      this.search,
      i,
      this.size
    )).pipe(
      takeUntil(this.destroy$)
    ).subscribe(page => {
      const pageOffset = i * this.size;
      this.page!.page.number = page.page.number;
      for (let offset = 0; offset < page.content.length; offset++) {
        this.page!.content[pageOffset + offset] = page.content[offset];
      }
      if (pinned?.length) this.page!.content.unshift(...pinned);

    });
  }

  private repost$(url: string, tags: string[]) {
    const rp = 'internal:' + uuid();
    return this.refs.create({
      url: rp,
      origin: this.store.account.origin,
      tags: ['plugin/repost', ...tags],
      sources: [url],
    }).pipe(
      catchError(err => {
        if (err.status === 403) {
          // TODO: better error message
          alert('Not allowed to use required tags. Ask admin for permission.');
        }
        return throwError(err);
      }),
    );
  }

  saveChanges(): boolean {
    return this.adding.length === 0 && this.failed.length === 0;
  }
}
