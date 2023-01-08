import { AfterViewInit, Component, HostBinding, Input, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { autorun, IReactionDisposer } from 'mobx';
import { catchError, map, Observable, Subject, switchMap, takeUntil, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { Store } from '../../store/store';
import { URI_REGEX } from '../../util/format';
import { getArgs, UrlFilter } from '../../util/query';
import { KanbanDrag } from '../kanban/kanban.component';

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

  constructor(
    private route: ActivatedRoute,
    private store: Store,
    private refs: RefService,
    private tags: TaggingService,
  ) {
    this.disposers.push(autorun(() => {
      this.sort = this.store.view.sort;
      this.filter = this.store.view.filter;
      this.search = this.store.view.search;
      if (this._query) this.clear();
    }));
  }

  get hasMore() {
    if (!this.pages || !this.pages.length) return false;
    return !this.pages[this.pages.length - 1].last;
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

  @Input()
  set query(value: string) {
    if (this._query === value) return;
    this._query = value;
    this.clear();
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
    this.addText = this.addText.trim();
    if (!this.addText) return;
    const tagsWithAuthor = !this.addTags.includes(this.store.account.localTag) ? [...this.addTags, this.store.account.localTag] : this.addTags;
    const ref = URI_REGEX.test(this.addText) ? {
      url: this.addText,
      tags: tagsWithAuthor,
    } : {
      url: 'comment:' + uuid(),
      title: this.addText,
      tags: tagsWithAuthor,
    };
    this.refs.create(ref).pipe(
      map(() => ref),
      catchError(err => {
        if (err.status === 409) {
          // Ref already exists, just tag it
          return this.tags.patch(this.addTags, ref.url).pipe(
            switchMap(() => this.refs.get(ref.url)),
          );
        }
        return throwError(err);
      }),
    ).subscribe(ref => {
      this.mutated = true;
      if (!this.pages) this.pages = [];
      this.pages[this.pages.length - 1].content.push(ref)
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
}
