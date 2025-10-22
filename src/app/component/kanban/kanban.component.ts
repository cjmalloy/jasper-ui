import { CdkDragDrop, CdkDropListGroup, ɵɵCdkScrollable, CdkDropList } from '@angular/cdk/drag-drop';
import {
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import { catchError, of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Ref, RefSort } from '../../model/ref';
import { KanbanConfig } from '../../mods/kanban';
import { AccountService } from '../../service/account.service';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';
import { negate, UrlFilter } from '../../util/query';
import { isQuery, isSelector, localTag, topAnds } from '../../util/tag';
import { KanbanColumnComponent } from './kanban-column/kanban-column.component';
import { MobxAngularModule } from 'mobx-angular';
import { LoadingComponent } from '../loading/loading.component';
import { RouterLink } from '@angular/router';
import { TitleDirective } from '../../directive/title.directive';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { AsyncPipe } from '@angular/common';

export interface KanbanDrag {
  from: string;
  to: string;
  ref: Ref;
  index: number;
}

@Component({
    selector: 'app-kanban',
    templateUrl: './kanban.component.html',
    styleUrls: ['./kanban.component.scss'],
    host: { 'class': 'kanban ext' },
    imports: [MobxAngularModule, LoadingComponent, CdkDropListGroup, ɵɵCdkScrollable, CdkDropList, RouterLink, TitleDirective, ReactiveFormsModule, FormsModule, PageControlsComponent, KanbanColumnComponent, AsyncPipe]
})
export class KanbanComponent implements OnChanges, OnDestroy, HasChanges {

  @ViewChildren(KanbanColumnComponent)
  list?: QueryList<KanbanColumnComponent>;

  @Input()
  query?: string;
  @Input()
  ext?: Ext;
  @Input()
  pageControls = true;
  @Input()
  fullPage = false;
  @Input()
  size = 8;
  @Input()
  sort: RefSort[] = [];
  @Input()
  filter: UrlFilter[] = [];
  @Input()
  search = '';

  error: any;
  updates = new Subject<KanbanDrag>();

  private _disableSwimLanes?: boolean;

  private defaultConfig: KanbanConfig = {
    columns: []
  };

  constructor(
    private accounts: AccountService,
    public bookmarks: BookmarkService,
    public store: Store,
    public exts: ExtService,
    private tags: TaggingService,
  ) { }

  saveChanges() {
    return !this.list?.find(r => !r.saveChanges());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ext) {
      this.preloadExts();
    }
    this.onResize();
  }

  ngOnDestroy() {
    this.updates.complete();
  }

  @HostListener('window:resize')
  onResize() {
    const margin = 20;
    const minColSize = 320;
    const sidebarSize = 354;
    runInAction(() => {
      this.store.view.floatingSidebar = innerWidth - sidebarSize < margin + minColSize * (this.columns.length + (this.showColumnBacklog ? 1 : 0))
    });
  }

  get disableSwimLanes(): boolean {
    return this._disableSwimLanes === undefined ? !!this.kanbanConfig.hideSwimLanes : this._disableSwimLanes;
  }

  set disableSwimLanes(value: boolean) {
    this._disableSwimLanes = value;
  }

  get columns(): string[] {
    if (this.filteredColumnBacklog) return [];
    if (this.filteredColumn) return [this.filteredColumn];
    if (!this.kanbanConfig.columns) return [this.ext!.tag];
    return without(this.kanbanConfig.columns, ...this.negateFilters);
  }

  get swimLanes(): string[] | undefined {
    if (this.disableSwimLanes) return undefined;
    if (!this.kanbanConfig.swimLanes) return undefined;
    if (!this.kanbanConfig.swimLanes.length) return undefined;
    if (this.filteredSwimLaneBacklog) return [];
    if (this.filteredSwimLane) return [this.filteredSwimLane];
    return without(this.kanbanConfig.swimLanes, ...this.negateFilters);
  }

  get andColBacklog() {
    return ':' + this.colBacklog;
  }

  get andSlBacklog() {
    if (this.disableSwimLanes) return '';
    if (!this.kanbanConfig.swimLanes?.length) return '';
    return ':' + this.slBacklog;
  }

  get colBacklog() {
    if (!this.kanbanConfig.columns?.length) return '';
    return this.kanbanConfig.columns.map(t => t.startsWith('!') ? t.substring(1) : ('!' + t)).join(':');
  }

  get slBacklog() {
    if (this.disableSwimLanes) return '';
    if (!this.kanbanConfig.swimLanes?.length) return '';
    return this.kanbanConfig.swimLanes.map(t => t.startsWith('!') ? t.substring(1) : ('!' + t)).join(':');
  }

  get kanbanConfig(): KanbanConfig {
    return this.ext?.config || this.defaultConfig;
  }

  get queryTags(): string[] {
    return uniq([
      ...topAnds(this.query).filter(t => !isQuery(t)),
      ...this.filter
        .filter(f => f.startsWith('query/'))
        .filter(f => !f.startsWith('query/!('))
        .map(f => f.substring('query/'.length)),
    ]);
  }

  get negateFilters(): string[] {
    // TODO: evaluate queries
    return uniq([
      ...topAnds(this.query).filter(t => isSelector(t))
        .map(f => f.startsWith('!') ? f.substring(1) : '!' + f),
      ...this.filter
        .filter(f => f.startsWith('query/'))
        .flatMap(f => f.startsWith('query/!(')
          ? [f.substring('query/!('.length, f.length - 1)]
          : topAnds(negate(f.substring('query/'.length)))),
    ]);
  }

  get filteredColumn() {
    const cols = this.kanbanConfig.columns || [this.ext?.tag];
    for (const tag of this.queryTags) {
      if (cols.includes(tag)) return tag;
    }
    return undefined;
  }

  get filteredColumnBacklog() {
    for (const tag of this.queryTags) {
      if (this.colBacklog === tag) return true;
    }
    return false;
  }

  get filteredSwimLane() {
    if (!this.kanbanConfig.swimLanes) return undefined;
    for (const tag of this.queryTags) {
      if (this.kanbanConfig.swimLanes.includes(tag)) return tag;
      if (this.slBacklog === tag) return tag;
    }
    return undefined;
  }

  get filteredSwimLaneBacklog() {
    if (!this.kanbanConfig.swimLanes) return false;
    for (const tag of this.queryTags) {
      if (this.slBacklog === tag) return true;
    }
    return false;
  }

  get showColumnBacklog() {
    if (this.negateFilters.includes(this.colBacklog)) return false;
    if (this.filteredColumnBacklog) return true;
    if (this.filteredColumn) return false;
    return this.kanbanConfig.showColumnBacklog;
  }

  get showSwimLaneBacklog() {
    if (this.negateFilters.includes(this.slBacklog)) return false;
    if (this.filteredSwimLaneBacklog) return true;
    if (this.filteredSwimLane) return false;
    return this.kanbanConfig.showSwimLaneBacklog;
  }

  preloadExts() {
    this.exts.getCachedExts([
      ...this.kanbanConfig.columns || [],
      ...this.kanbanConfig.swimLanes || [],
      ...this.kanbanConfig.badges || [],
    ]).subscribe();
  }

  /**
   * Tags to apply to new Refs created on the board.
   */
  addingTags(tags: { col?: string, sl?: string }) {
    const result = [
        ...this.kanbanConfig.addTags || [],
        ...this.store.view.queryTags.map(localTag),
    ];
    result.push(this.ext!.tag);
    if (tags.col) result.push(tags.col);
    if (tags.sl) result.push(tags.sl);
    return uniq(result);
  }

  getQuery(tags?: { col?: string, sl?: string }) {
    if (!tags) return '';
    const cols =  tags.col ? ':' + tags.col : this.andColBacklog;
    const sl =  tags.sl ? ':' + tags.sl : this.andSlBacklog;
    return '(' + this.query + ')' + cols + sl;
  }

  drop(event: CdkDragDrop<{ sl?: string, col?: string }>) {
    const ref = event.item.data as Ref;
    const from = Object.values(event.previousContainer.data);
    const to = Object.values(event.container.data || {});
    const remove = from.filter(t => !to.includes(t));
    const add = to.filter(t => !from.includes(t));

    // Optimistically update, revert in case of error
    const oldTags = ref.tags;
    ref.tags = [
      ...(ref.tags || []).filter(t => !remove.includes(t)),
      ...add];
    this.updates.next({
      from: this.getQuery(event.previousContainer.data),
      to: this.getQuery(event.container.data),
      ref,
      index: event.currentIndex,
    });
    if (this.store.view.lastSelected?.url === ref.url) {
      this.store.view.clearLastSelected();
    }

    const tags = [...remove.map(t => `-${t}`), ...add];
    if (!tags.length) return;
    this.tags.patch(tags, ref.url, ref.origin).pipe(
      tap(cursor => this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor))),
      catchError(() => {
        // Revert
        ref.tags = oldTags;
        this.updates.next({
          from: this.getQuery(event.container.data),
          to: this.getQuery(event.previousContainer.data),
          ref,
          index: event.previousIndex,
        });
        return of(null);
      }),
    ).subscribe();
  }

}
