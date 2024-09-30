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
import { isEqual, uniq } from 'lodash-es';
import * as moment from 'moment';
import { catchError, Observable, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref, RefSort } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { ConfigService } from '../../../service/config.service';
import { OembedStore } from '../../../store/oembed';
import { Store } from '../../../store/store';
import { URI_REGEX } from '../../../util/format';
import { fixUrl } from '../../../util/http';
import { getArgs, UrlFilter } from '../../../util/query';
import { KanbanDrag } from '../kanban.component';

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss']
})
export class KanbanColumnComponent implements AfterViewInit, OnChanges, OnDestroy {
  @HostBinding('class') css = 'kanban-column';
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

  private currentRequest?: Subscription;
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
    return this.page.totalElements - this.page.numberOfElements;
  }

  get hasMore() {
    if (!this.page) return false;
    return !this.page.last;
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
    this.currentRequest?.unsubscribe();
    this.currentRequest = this.refs.page(getArgs(
      this.query,
      this.sort,
      this.filter,
      this.search,
      0,
      this.size,
    )).pipe(
      takeUntil(this.destroy$)
    ).subscribe(page => {
      this.page = page;
    });
  }

  update(event: KanbanDrag) {
    if (!this.page) return;
    if (event.from === this.query) {
      if (this.page.content.includes(event.ref)) {
        this.mutated ||= event.from !== event.to;
        this.page.numberOfElements--;
        this.page.totalElements--;
        this.page.content.splice(this.page.content.indexOf(event.ref), 1);
      }
    }
    if (event.to === this.query) {
      this.mutated ||= event.from !== event.to;
      this.page.numberOfElements++;
      this.page.totalElements++;
      this.page.content.splice(Math.min(event.index, this.page.numberOfElements - 1), 0, event.ref);
    }
  }

  copy(ref: Ref) {
    if (!this.page) return;
    const index = this.page.content.findIndex(r => r.url === ref.url);
    if (index < 0) return;
    this.page.content.splice(index, 1, ref);
  }

  loadMore() {
    const pageNumber = this.page?.number || 0;
    if (this.page && this.mutated) {
      for (let i = 0; i <= pageNumber; i++) {
        this.refreshPage(i);
      }
    }
    this.mutated = false;
    this.refreshPage(pageNumber + 1);
  }

  add() {
    // TODO: Move to util function
    this.addText = this.addText.trim();
    if (!this.addText) return;
    const text = this.addText;
    this.addText = '';
    this.adding.push(text);
    const tagsWithAuthor = !this.addTags.includes(this.store.account.localTag) ? [...this.addTags, this.store.account.localTag] : this.addTags;
    const isUrl = URI_REGEX.test(text) && this.config.allowedSchemes.filter(s => text.startsWith(s)).length;
    // TODO: support local urls
    const ref: Ref = isUrl ? {
      url: fixUrl(text, this.admin.getTemplate('banlist') || this.admin.def.templates.banlistConfig),
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
        if (this.admin.getPlugin('plugin/vote/up')) {
          this.tags.createResponse('plugin/vote/up', ref.url);
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
        return throwError(err);
      }),
      tap(cursor => this.accounts.clearNotificationsIfNone(moment(cursor))),
    ).subscribe(cursor => {
      this.mutated = true;
      this.adding.splice(this.adding.indexOf(text), 1);
      if (!this.page) {
        console.error('Should not happen, will probably get cleared.');
        this.page = {content: []} as any;
      }
      ref.modified = moment(cursor);
      ref.modifiedString = cursor;
      this.page!.content.push(ref)
    });
  }

  private refreshPage(i: number) {
    this.refs.page(getArgs(
      this.query,
      this.sort,
      this.filter,
      this.search,
      i,
      this.size
    )).subscribe(page => {
      const pageOffset = i * this.size;
      this.page!.number = page.number;
      this.page!.numberOfElements = Math.max(this.page!.numberOfElements, pageOffset + page.numberOfElements);
      this.page!.last = page.last;
      for (let offset = 0; offset < page.numberOfElements; offset++) {
        this.page!.content[pageOffset + offset] = page.content[offset];
      }
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
          window.alert('Not allowed to use required tags. Ask admin for permission.');
        }
        return throwError(err);
      }),
    );
  }
}
