import {
  CdkDrag
} from '@angular/cdk/drag-drop';
import { FakeLinkDirective } from '../../../directive/fake-link.directive';
import { HttpEventType } from '@angular/common/http';
import {
  DestroyRef,
  inject,
  Component,
  computed,
  effect,
  untracked,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { isEqual, uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, last, map, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref, RefSort } from '../../../model/ref';
import { mimeToCode } from '../../../mods/media/code';
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
import type { KanbanDrag } from '../kanban.component';

interface PendingUpload {
  id: string;
  name: string;
  progress?: number;
}

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss'],
  host: {
    'class': 'kanban-column',
    '[class.dropping]': 'dropping()',
    '[class.empty]': 'empty()',
    '(touchstart)': 'touchstart($event)',
    '(contextmenu)': 'contextmenu($event)',
    '(drop)': 'handleDrop($event)',
    '(dragenter)': 'handleDragEnter($event)',
    '(dragover)': 'handleDragOver($event)',
    '(dragleave)': 'dragLeave($event)',
  },
  imports: [
    FakeLinkDirective,
    KanbanCardComponent,
    CdkDrag,
    LoadingComponent,
    ReactiveFormsModule,
  ],
})
export class KanbanColumnComponent implements HasChanges {
  config = inject(ConfigService);
  private accounts = inject(AccountService);
  private admin = inject(AdminService);
  private store = inject(Store);
  private oembeds = inject(OembedStore);
  private refs = inject(RefService);
  private tags = inject(TaggingService);
  private proxy = inject(ProxyService);

  private destroyRef = inject(DestroyRef);

  readonly query = input('');
  readonly hideSwimLanes = input(true);
  readonly updates = input<Observable<KanbanDrag>>();
  readonly addTags = input<string[]>([]);
  readonly ext = input<Ext>();
  readonly size = input(8);
  readonly sort = input<RefSort[]>([]);
  readonly filter = input<UrlFilter[]>([]);
  readonly search = input('');

  readonly page = signal<Page<Ref> | undefined>(undefined);
  readonly mutated = signal(false);
  readonly addText = signal('');
  readonly pressToUnlock = signal(false);
  readonly adding = signal<PendingUpload[]>([]);
  readonly failed = signal<{ text: string; error: string }[]>([]);
  readonly dropping = signal(false);








  private currentRequest?: Subscription;
  private runningSources?: Subscription;
  private runningResponses?: Subscription;
  private readonly requestInputs = computed(() => ({
    query: this.query(),
    size: this.size(),
    sort: [...this.sort()],
    filter: [...this.filter()],
  }), { equal: isEqual });

  constructor() {
    const config = this.config;

    if (config.mobile) {
      this.pressToUnlock.set(true);
    }
    let previous: ReturnType<typeof this.requestInputs> | undefined;
    effect(() => {
      const inputs = this.requestInputs();
      this.search();
      untracked(() => this.clear(inputs !== previous));
      previous = inputs;
    });
    effect(onCleanup => {
      const subscription = this.updates()?.subscribe(event => this.update(event));
      onCleanup(() => subscription?.unsubscribe());
    });
  }

  readonly empty = computed(() => {
    return !this.page()?.content.length;
  });

  readonly more = computed(() => {
    const page = this.page();
    if (!page) return 0;
    return page.page.totalElements - page.content.length;
  });

  readonly hasMore = computed(() => {
    const page = this.page();
    if (!page) return false;
    return page.page.number < page.page.totalPages - 1;
  });

  touchstart(e: TouchEvent) {
    this.pressToUnlock.set(true);
  }

  contextmenu(event: MouseEvent) {
    if (this.pressToUnlock()) event.preventDefault();
  }

  clear(removeCurrent = true) {
    if (removeCurrent) this.page.set(undefined);
    const args = getArgs(
      this.query(),
      this.sort(),
      this.filter(),
      this.search(),
      0,
      this.size(),
    );
    this.currentRequest?.unsubscribe();
    this.currentRequest = this.refs.page(args).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(page => {
      this.page.set(page);
      this.runningSources?.unsubscribe();
      if (args.sources) {
        this.runningSources = this.refs.page({ ...args, url: args.sources, size: 1, sources: undefined, responses: undefined }).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe(res => {
          if (res.content[0]) {
            this.mutated.set(true);
            // @ts-ignore
            res.content[0]['pinned'] = true
            this.page.update(p => p && { ...p, content: [res.content[0], ...p.content] });
          }
        });
      }
      this.runningResponses?.unsubscribe();
      if (args.responses) {
        this.runningResponses = this.refs.page({ ...args, url: args.responses, size: 1, sources: undefined, responses: undefined }).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe(res => {
          if (res.content[0]) {
            this.mutated.set(true);
            // @ts-ignore
            res.content[0]['pinned'] = true
            this.page.update(p => p && { ...p, content: [res.content[0], ...p.content] });
          }
        });
      }
    });
  }

  update(event: KanbanDrag) {
    let page = this.page();
    if (!page) return;
    const query = this.query();
    if (event.from === query) {
      const index = page.content.findIndex(ref => ref.url === event.ref.url && ref.origin === event.ref.origin);
      if (index >= 0) {
        if (event.from !== event.to) this.mutated.set(true);
        page = {
          ...page,
          page: { ...page.page, totalElements: page.page.totalElements - 1 },
          content: page.content.filter((_, i) => i !== index),
        };
        this.page.set(page);
      }
    }
    if (event.to === query) {
      if (event.from !== event.to) this.mutated.set(true);
      const content = [...page.content];
      content.splice(Math.min(event.index, content.length - 1), 0, event.ref);
      this.page.set({
        ...page,
        page: { ...page.page, totalElements: page.page.totalElements + 1 },
        content,
      });
    }
  }

  copy(ref: Ref) {
    const page = this.page();
    if (!page) return;
    const index = page.content.findIndex(r => r.url === ref.url);
    if (index < 0) return;
    const content = [...page.content];
    content.splice(index, 1, ref);
    this.page.set({ ...page, content });
  }

  loadMore() {
    const pinned: Ref[] = [];
    const pageNumber = this.page()?.page.number || 0;
    if (this.page() && this.mutated()) {
      // @ts-ignore
      pinned.push(...this.page().content.filter(r => r['pinned']));
      for (let i = 0; i <= pageNumber; i++) {
        this.refreshPage(i);
      }
    }
    this.mutated.set(false);
    this.refreshPage(pageNumber + 1, pinned);
  }

  add() {
    // TODO: Move to util function
    this.addText.update(text => text.trim());
    if (!this.addText()) return;
    const text = this.addText();
    this.addText.set('');
    const uploadId = uuid();
    this.adding.update(adding => [...adding, { id: uploadId, name: text }]);
    const tagsWithAuthor = this.getTagsWithAuthor();
    const isUrl = URI_REGEX.test(text) && this.config.allowedSchemes.filter(s => text.startsWith(s)).length;
    // TODO: support local urls
    const ref: Ref = isUrl ? {
      url: fixUrl(text, this.admin.getTemplate('config/banlist') || this.admin.def.templates['config/banlist']),
      origin: this.store.account.origin(),
      tags: [...tagsWithAuthor],
    } : {
      url: 'comment:' + uuid(),
      origin: this.store.account.origin(),
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
          return this.tags.patch(this.addTags(), ref.url, ref.origin).pipe(
            catchError(err => {
              if (err.status === 403) {
                // Can't edit Ref, repost it
                return this.repost$(ref.url, tagsWithAuthor);
              }
              return throwError(err);
            }),
          );
        }
        this.adding.update(adding => adding.filter(u => u.id !== uploadId));
        this.failed.update(failed => [...failed, { text, error: printError(err).join('\n') }]);
        return throwError(err);
      }),
      tap(cursor => this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor))),
    ).subscribe(cursor => {
      this.mutated.set(true);
      this.adding.update(adding => adding.filter(u => u.id !== uploadId));
      if (!this.page()) {
        console.error('Should not happen, will probably get cleared.');
        this.page.set({content: []} as any);
      }
      ref.modified = DateTime.fromISO(cursor);
      ref.modifiedString = cursor;
      this.page.update(page => ({ ...page!, content: [...page!.content, ref] }));
    });
  }

  retry(failedItem: { text: string; error: string }) {
    this.failed.update(failed => without(failed, failedItem));
    this.addText.set(failedItem.text);
    this.add();
  }

  dismissFailed(failedItem: { text: string; error: string }) {
    this.failed.update(failed => without(failed, failedItem));
  }

  private getTagsWithAuthor(): string[] {
    const addTags = this.addTags();
    return uniq(!hasTag(this.store.account.localTag(), addTags)
      ? [...addTags, this.store.account.localTag()]
      : addTags).filter(t => !!t);
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
    event.preventDefault();
    event.stopPropagation();
    this.dropping.set(false);
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
      this.uploadFiles(files);
    }
  }

  handleDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dropping.set(true);
  }

  handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  dragLeave(event: DragEvent) {
    if (this.dropping() && event.target === event.currentTarget) {
      this.dropping.set(false);
    }
  }

  uploadFiles(files: File[]) {
    if (!files.length) return;
    if (!this.admin.getPlugin('plugin/file')) return;

    files.forEach(file => {
      const uploadId = uuid();
      const fileName = file.name;
      this.adding.update(adding => [...adding, { id: uploadId, name: fileName, progress: 0 }]);

      this.uploadFile$(file, uploadId).pipe(
        catchError(err => {
          this.adding.update(adding => adding.filter(u => u.id !== uploadId));
          this.failed.update(failed => [...failed, { text: fileName, error: printError(err).join('\n') }]);
          return of(null);
        }),
      ).subscribe(ref => {
        if (ref) this.submitUpload(ref, uploadId);
      });
    });
  }

  uploadFile$(file: File, uploadId: string): Observable<Ref | null> {
    const tagsWithAuthor = this.getTagsWithAuthor();

    const codeType = mimeToCode(file.type);
    if (codeType.length) {
      const ref: Ref = {
        origin: this.store.account.origin(),
        url: 'internal:' + uuid(),
        title: file.name,
        tags: [...tagsWithAuthor, 'internal', ...file.type === 'text/markdown' ? [] : codeType]
      };
      this.setProgress(uploadId, 50);
      return readFileAsString(file).pipe(
        switchMap(contents => this.refs.create({
          ...ref,
          comment: contents,
        })),
        map(() => ref),
        tap(() => {
          this.setProgress(uploadId, 100);
        }),
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

      return this.proxy.save(file, this.store.account.origin()).pipe(
        map(event => {
          switch (event.type) {
            case HttpEventType.Response:
              return event.body;
            case HttpEventType.UploadProgress:
              const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;
              this.setProgress(uploadId, percentDone);
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

  private setProgress(uploadId: string, progress: number) {
    this.adding.update(adding => adding.map(u => u.id === uploadId ? { ...u, progress } : u));
  }

  submitUpload(ref: Ref, uploadId: string) {
    if (!this.page()) {
      // Initialize page if it doesn't exist yet
      this.page.set({ content: [], page: { totalElements: 0, number: 0, totalPages: 0, size: 0 } } as Page<Ref>);
    }

    ref.origin = this.store.account.origin();

    this.mutated.set(true);
    this.adding.update(adding => adding.filter(u => u.id !== uploadId));
    this.page.update(page => ({ ...page!, content: [...page!.content, ref] }));
  }

  private refreshPage(i: number, pinned?: Ref[]) {
    this.refs.page(getArgs(
      this.query(),
      this.sort(),
      this.filter(),
      this.search(),
      i,
      this.size()
    )).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(page => {
      const pageOffset = i * this.size();
      const current = this.page()!;
      const content = [...current.content];
      for (let offset = 0; offset < page.content.length; offset++) {
        content[pageOffset + offset] = page.content[offset];
      }
      if (pinned?.length) content.unshift(...pinned);
      this.page.set({ ...current, page: { ...current.page, number: page.page.number }, content });
    });
  }

  private repost$(url: string, tags: string[]) {
    const rp = 'internal:' + uuid();
    return this.refs.create({
      url: rp,
      origin: this.store.account.origin(),
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
    return this.adding().length === 0 && this.failed().length === 0;
  }
}
