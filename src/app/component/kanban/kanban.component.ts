import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { uniq } from 'lodash-es';
import { catchError, of, Subject } from 'rxjs';
import { Ext } from '../../model/ext';
import { Ref, RefSort } from '../../model/ref';
import { KanbanConfig } from '../../mods/kanban';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';
import { UrlFilter } from '../../util/query';

export interface KanbanDrag {
  from: string;
  to: string;
  ref: Ref;
  index: number;
}

@Component({
  selector: 'app-kanban',
  templateUrl: './kanban.component.html',
  styleUrls: ['./kanban.component.scss']
})
export class KanbanComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'kanban ext';

  @Input()
  query?: string;
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

  error: any;
  updates = new Subject<KanbanDrag>();

  private _disableSwimLanes?: boolean;

  private defaultConfig: KanbanConfig = {
    columns: []
  };

  constructor(
    public bookmarks: BookmarkService,
    private store: Store,
    public exts: ExtService,
    private tags: TaggingService,
  ) { }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.updates.complete();
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
    return this.kanbanConfig.columns || [this.ext!.tag];
  }

  get swimLanes(): string[] | undefined {
    if (this.disableSwimLanes) return undefined;
    if (!this.kanbanConfig.swimLanes) return undefined;
    if (!this.kanbanConfig.swimLanes.length) return undefined;
    if (this.filteredSwimLaneBacklog) return [];
    if (this.filteredSwimLane) return [this.filteredSwimLane];
    return this.kanbanConfig.swimLanes;
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

  get queryFilters(): string[] {
    return this.filter
      .filter(f => f.startsWith('query/'))
      .map(f => f.substring('query/'.length));
  }

  get filteredColumn() {
    const cols = this.kanbanConfig.columns || [this.ext?.tag];
    for (const f of this.queryFilters) {
      if (cols.includes(f)) return f;
    }
    return undefined;
  }

  get filteredColumnBacklog() {
    for (const f of this.queryFilters) {
      if (this.colBacklog === f) return true;
    }
    return false;
  }

  get filteredSwimLane() {
    if (!this.kanbanConfig.swimLanes) return undefined;
    for (const f of this.queryFilters) {
      if (this.kanbanConfig.swimLanes.includes(f)) return f;
      if (this.slBacklog === f) return f;
    }
    return undefined;
  }

  get filteredSwimLaneBacklog() {
    if (!this.kanbanConfig.swimLanes) return false;
    for (const f of this.queryFilters) {
      if (this.slBacklog === f) return true;
    }
    return false;
  }

  get showColumnBacklog() {
    if (this.filteredColumnBacklog) return true;
    if (this.filteredColumn) return false;
    return this.kanbanConfig.showColumnBacklog;
  }

  get showSwimLaneBacklog() {
    if (this.filteredSwimLaneBacklog) return true;
    if (this.filteredSwimLane) return false;
    return this.kanbanConfig.showSwimLaneBacklog;
  }

  /**
   * Tags to apply to new Refs created on the board.
   */
  addingTags(tags: { col?: string, sl?: string }) {
    const result = [
        ...this.kanbanConfig.addTags || [],
        ...this.store.view.queryTags
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

    const tags = [...remove.map(t => `-${t}`), ...add];
    if (!tags.length) return;
    this.tags.patch(tags, ref.url, ref.origin).pipe(
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
