import { AfterViewInit, Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash-es';
import { catchError, combineLatest, map, Observable, of, Subject, switchMap, takeUntil, throwError } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { TAG_REGEX } from '../../util/format';
import { filterListToObj, getArgs } from '../../util/query';
import { KanbanDrag } from '../kanban/kanban.component';

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss']
})
export class KanbanColumnComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'kanban-column';
  private destroy$ = new Subject<void>();

  @Input()
  updates?: Observable<KanbanDrag>;

  query$ = new Subject<string>();
  _query?: string;
  size = 20;
  pages: Page<Ref>[] = [];
  mutated = false;
  addText = '';
  sort = '';
  filter = [];
  search = '';

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    combineLatest(
      this.query$, this.sort$, this.filter$, this.search$
    ).pipe(
      map(([query, sort, filter, search]) =>
        getArgs(query, sort, {...filterListToObj(filter)}, search, 0, this.size)),
      distinctUntilChanged(_.isEqual),
      switchMap(args => this.refs.page(args)),
    ).subscribe(page => {
      this.pages = [page];
    });
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
  }

  @Input()
  set query(value: string) {
    if (this._query === value) return;
    this._query = value;
    this.query$.next(value);
  }

  get sort$() {
    return this.route.params.pipe(
      map(params => params['sort']),
      tap(sort => this.sort = sort),
    );
  }

  get filter$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['filter']),
      tap(filter => this.filter = filter),
    );
  }

  get search$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['search']),
      tap(search => this.search = search),
    );
  }

  update(event: KanbanDrag) {
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
    if (this.mutated) {
      this.mutated = false;
      for (let i = 0; i < this.pages.length; i++) {
        this.refreshPage(i);
      }
    }
    this.refs.page(getArgs(
      this._query, this.sort, {...filterListToObj(this.filter)}, this.search, this.pages.length, this.size
    )).subscribe(page => {
      this.pages.push(page);
    });
  }

  add() {
    if (!this.addText) return;
    const ref = {
      url: 'comment:' + uuid(),
      title: this.addText,
      tags: this._query?.split(':').filter(t => TAG_REGEX.test(t)),
    };
    this.refs.create(ref).subscribe(() => {
      this.mutated = true;
      this.pages[this.pages.length - 1].content.push(ref)
    });
    this.addText = '';
  }

  private refreshPage(i: number) {
    this.refs.page(getArgs(
      this._query, this.sort, {...filterListToObj(this.filter)}, this.search, i, this.size
    )).subscribe(page => {
      this.pages[i] = page;
    });
  }
}
