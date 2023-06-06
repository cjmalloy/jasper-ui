import { AfterViewInit, Component, HostBinding, HostListener, Input, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, Observable, of, Subject, switchMap, takeUntil, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Page } from '../../../model/page';
import { Ref, RefSort } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { TaggingService } from '../../../service/api/tagging.service';
import { OembedStore } from '../../../store/oembed';
import { Store } from '../../../store/store';
import { URI_REGEX } from '../../../util/format';
import { fixUrl } from '../../../util/http';
import { getArgs, UrlFilter } from '../../../util/query';
import { KanbanDrag } from '../kanban.component';
import { ConfigService } from "../../../service/config.service";
import { CdkDragStart } from "@angular/cdk/drag-drop";

const LONG_TOUCH_MS = 1000;

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss']
})
export class KanbanColumnComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'kanban-column';
  private destroy$ = new Subject<void>();
  private disposers: IReactionDisposer[] = [];

  @Input()
  updates?: Observable<KanbanDrag>;
  @Input()
  addTags: string[] = [];

  _query = '';
  size = 20;
  pages?: Page<Ref>[];
  mutated = false;
  addText = '';
  sort: RefSort[] = [];
  filter: UrlFilter[] = [];
  search = '';
  dragDisabled = false;
  pressToUnlock = false;
  private unlocked = false;

  constructor(
    public config: ConfigService,
    private route: ActivatedRoute,
    private admin: AdminService,
    private store: Store,
    private oembeds: OembedStore,
    private refs: RefService,
    private tags: TaggingService,
  ) {
    this.disposers.push(autorun(() => {
      this.sort = this.store.view.sort;
      this.filter = this.store.view.filter;
      this.search = this.store.view.search;
      if (this._query) this.clear();
    }));
    if (config.mobile) {
      this.pressToUnlock = true;
    }
  }

  get hasMore() {
    if (!this.pages || !this.pages.length) return false;
    return !this.pages[this.pages.length - 1].last;
  }

  @Input()
  set query(value: string) {
    if (this._query === value) return;
    this._query = value;
    this.clear();
  }

  ngAfterViewInit(): void {
    this.updates?.pipe(
      takeUntil(this.destroy$),
    ).subscribe(event => this.update(event));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @HostListener('touchstart', ['$event'])
  touchstart(e: TouchEvent) {
    this.unlocked = false;
    this.dragDisabled = false;
  }

  @HostListener('touchend', ['$event'])
  touchend(e: TouchEvent) {
    this.unlocked = false;
    this.dragDisabled = false;
  }

  @HostListener('mouseup', ['$event'])
  mouseup(e: MouseEvent) {
    this.pressToUnlock = false;
    this.dragDisabled = false;
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    this.unlocked = true;
  }

  dragStarted(event: CdkDragStart<Ref>) {
    if (this.pressToUnlock && !this.unlocked) {
      this.dragDisabled = true;
    }
  }

  clear() {
    this.refs.page(getArgs(
      this._query,
      this.sort,
      this.filter,
      this.search,
      0,
      this.size
    )).subscribe(page => {
      this.pages = [page];
    });
  }

  update(event: KanbanDrag) {
    if (!this.pages) return;
    if (event.from === this._query) {
      for (const p of this.pages) {
        if (p.content.includes(event.ref)) {
          p.content.splice(p.content.indexOf(event.ref), 1);
          break;
        }
      }
    }
    if (event.to === this._query) {
      this.pages[Math.floor(event.index / this.size)].content.splice(event.index % this.size, 0, event.ref);
    }
  }

  loadMore() {
    if (this.pages && this.mutated) {
      for (let i = 0; i < this.pages.length; i++) {
        this.refreshPage(i);
      }
    }
    this.mutated = false;
    this.refs.page(getArgs(
      this._query,
      this.sort,
      this.filter,
      this.search,
      this.pages?.length || 0,
      this.size
    )).subscribe(page => {
      if (!this.pages) this.pages = [];
      this.pages.push(page);
    });
  }

  add() {
    // TODO: Move to util function
    this.addText = this.addText.trim();
    if (!this.addText) return;
    const tagsWithAuthor = !this.addTags.includes(this.store.account.localTag) ? [...this.addTags, this.store.account.localTag] : this.addTags;
    const isUrl = URI_REGEX.test(this.addText);
    const ref = isUrl ? {
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
        if (oembed) {
          ref.title = oembed.title;
          ref.tags.push('plugin/embed');
          ref.tags.push('plugin/thumbnail');
        } else {
          ref.tags.push(...this.admin.getPluginsForUrl(ref.url).map(p => p.tag));
        }
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
      if (!this.pages) this.pages = [];
      this.pages[this.pages.length - 1].content.push(posted || ref)
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
      if (!this.pages) this.pages = [];
      this.pages[i] = page;
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
