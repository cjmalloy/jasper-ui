import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { uniq } from 'lodash-es';
import { catchError, of, Subject } from 'rxjs';
import { Ext } from '../../model/ext';
import { Ref } from '../../model/ref';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';
import { Store } from '../../store/store';
import { defaultOrigin } from '../../util/tag';
import { KanbanConfig } from '../../mods/template/kanban';
import { BookmarkService } from '../../service/bookmark.service';

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

  ext?: Ext;
  disableSwimLanes = false;
  error: any;
  updates = new Subject<KanbanDrag>();

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

  @Input()
  set tag(value: string) {
    if (this.ext?.tag === value) return;
    this.exts.getCachedExt(defaultOrigin(value, this.store.account.origin)).pipe(
      catchError(err => {
        this.error = err;
        return of(undefined);
      }),
    ).subscribe(ext => this.ext = ext);
  }

  get columns(): string[] {
    if (this.filteredNoColumn) return [];
    if (this.filteredColumn) return [this.filteredColumn];
    return this.kanbanConfig.columns;
  }

  get swimLanes(): string[] | undefined {
    if (this.disableSwimLanes) return undefined;
    if (!this.kanbanConfig.swimLanes) return undefined;
    if (!this.kanbanConfig.swimLanes.length) return undefined;
    if (this.filteredNoSwimLane) return [];
    if (this.filteredSwimLane) return [this.filteredSwimLane];
    return this.kanbanConfig.swimLanes;
  }

  get andNoCols() {
    if (!this.kanbanConfig.columns?.length) return '';
    return ':' + this.noCols;
  }

  get andNoSl() {
    if (this.disableSwimLanes) return '';
    if (!this.kanbanConfig.swimLanes?.length) return '';
    return ':' + this.noSl;
  }

  get noCols() {
    if (!this.kanbanConfig.columns?.length) return '';
    return this.kanbanConfig.columns.map(t => '!' + t).join(':');
  }

  get noSl() {
    if (this.disableSwimLanes) return '';
    if (!this.kanbanConfig.swimLanes?.length) return '';
    return this.kanbanConfig.swimLanes.map(t => '!' + t).join(':');
  }

  get kanbanConfig(): KanbanConfig {
    return this.ext!.config;
  }

  get filteredColumn() {
    for (const f of this.store.view.queryFilters) {
      if (this.kanbanConfig.columns.includes(f)) return f;
    }
    return undefined;
  }

  get filteredNoColumn() {
    if (!this.kanbanConfig.columns) return false;
    for (const f of this.store.view.queryFilters) {
      if (this.noCols === f) return true;
    }
    return false;
  }

  get filteredSwimLane() {
    if (!this.kanbanConfig.swimLanes) return undefined;
    for (const f of this.store.view.queryFilters) {
      if (this.kanbanConfig.swimLanes.includes(f)) return f;
      if (this.noSl === f) return f;
    }
    return undefined;
  }

  get filteredNoSwimLane() {
    if (!this.kanbanConfig.swimLanes) return false;
    for (const f of this.store.view.queryFilters) {
      if (this.noSl === f) return true;
    }
    return false;
  }

  get showNoColumn() {
    if (this.filteredNoColumn) return true;
    if (this.filteredColumn) return false;
    return this.kanbanConfig.showNoColumn;
  }

  get showNoSwimLane() {
    if (this.filteredNoSwimLane) return true;
    if (this.filteredSwimLane) return false;
    return this.kanbanConfig.showNoSwimLane;
  }

  /**
   * Tags to apply to new Refs created on the board.
   */
  addingTags(tags: { col?: string, sl?: string }) {
    const result = [ ...this.kanbanConfig.addTags || [] ];
    result.push(this.ext!.tag);
    if (tags.col) result.push(tags.col);
    if (tags.sl) result.push(tags.sl);
    return uniq(result);
  }

  getQuery(tags?: { col?: string, sl?: string }) {
    if (!tags) return '';
    const kanbanTag = defaultOrigin(this.ext!.tag, this.store.account.origin);
    const cols =  tags.col ? ':' + tags.col : this.andNoCols;
    const sl =  tags.sl ? ':' + tags.sl : this.andNoSl;
    return kanbanTag + cols + sl;
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
