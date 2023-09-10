import { AfterViewInit, Component, HostBinding, HostListener, Input, OnDestroy } from '@angular/core';
import { uniq } from 'lodash-es';
import { catchError, Observable, Subject, switchMap, takeUntil, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref, RefSort } from '../../../model/ref';
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
export class KanbanColumnComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'kanban-column';
  private destroy$ = new Subject<void>();

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

  _query = '';
  page?: Page<Ref>;
  mutated = false;
  addText = '';
  pressToUnlock = false;

  constructor(
    public config: ConfigService,
    private admin: AdminService,
    private store: Store,
    private oembeds: OembedStore,
    private refs: RefService,
    private tags: TaggingService,
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByUrlOrigin(index: number, value: Ref) {
    return value.origin + '@' + value.url;
  }

  @Input()
  set query(value: string) {
    if (this._query === value) return;
    this._query = value;
    this.clear();
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
    this.pressToUnlock = true;
  }

  @HostListener('contextmenu', ['$event'])
  contextmenu(event: MouseEvent) {
    if (this.pressToUnlock) event.preventDefault();
  }

  clear() {
    this.refs.page(getArgs(
      this._query,
      this.sort,
      this.filter,
      this.search,
      0,
      this.size,
    )).subscribe(page => {
      this.page = page;
    });
  }

  update(event: KanbanDrag) {
    if (!this.page) return;
    if (event.from === this._query) {
      if (this.page.content.includes(event.ref)) {
        this.page.content.splice(this.page.content.indexOf(event.ref), 1);
      }
    }
    if (event.to === this._query) {
      this.page.content.splice(Math.min(event.index, this.page.numberOfElements - 1), 0, event.ref);
    }
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
    const tagsWithAuthor = !this.addTags.includes(this.store.account.localTag) ? [...this.addTags, this.store.account.localTag] : this.addTags;
    const isUrl = URI_REGEX.test(this.addText) && this.config.allowedSchemes.filter(s => this.addText.startsWith(s)).length;
    const ref: Ref = isUrl ? {
      url: fixUrl(this.addText),
      origin: this.store.account.origin,
      tags: [...tagsWithAuthor],
    } : {
      url: 'comment:' + uuid(),
      origin: this.store.account.origin,
      title: this.addText,
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
        if (this.admin.status.plugins.voteUp) {
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
            switchMap(() => this.refs.get(ref.url, ref.origin)),
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
    ).subscribe(posted => {
      this.mutated = true;
      if (!this.page) {
        console.error('Should not happen, will probably get cleared.');
        this.page = {content: []} as any;
      }
      this.page!.content.push(posted || ref)
    });
    this.addText = '';
  }

  private refreshPage(i: number) {
    this.refs.page(getArgs(
      this._query,
      this.sort,
      this.filter,
      this.search,
      i,
      this.size
    )).subscribe(page => {
      const pageOffset = this.page!.numberOfElements;
      this.page!.number = page.number;
      this.page!.numberOfElements += page.numberOfElements;
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
      switchMap(() => this.refs.get(rp, this.store.account.origin)),
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
