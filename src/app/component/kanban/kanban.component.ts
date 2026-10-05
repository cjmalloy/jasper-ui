import { CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { AsyncPipe } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  untracked,
  viewChildren
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { uniq, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, of, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TitleDirective } from '../../directive/title.directive';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Ref, RefSort } from '../../model/ref';
import { KanbanConfig } from '../../mods/org/kanban';
import { AccountService } from '../../service/account.service';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';
import { BookmarkService } from '../../service/bookmark.service';
import { Store } from '../../store/store';
import { negate, UrlFilter } from '../../util/query';
import { isQuery, isSelector, localTag, topAnds } from '../../util/tag';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { KanbanColumnComponent } from './kanban-column/kanban-column.component';

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
  host: { 'class': 'kanban ext', '(window:resize)': 'onResize()' },
  imports: [
    forwardRef(() => KanbanColumnComponent),
    LoadingComponent,
    CdkDropListGroup,
    CdkScrollable,
    CdkDropList,
    RouterLink,
    TitleDirective,
    ReactiveFormsModule,
    PageControlsComponent,
    AsyncPipe,
  ],
})
export class KanbanComponent implements HasChanges {
  private accounts = inject(AccountService);
  bookmarks = inject(BookmarkService);
  store = inject(Store);
  exts = inject(ExtService);
  private tags = inject(TaggingService);


  readonly list = viewChildren(KanbanColumnComponent);

  readonly query = input<string>();
  readonly ext = input<Ext | undefined>(undefined);
  readonly pageControls = input(true);
  readonly fullPage = input(false);
  readonly size = input(8);
  readonly sort = input<RefSort[]>([]);
  readonly filter = input<UrlFilter[]>([]);
  readonly search = input('');

  error: any;
  updates = new Subject<KanbanDrag>();

  protected readonly swimLanesOverride = signal<boolean | undefined>(undefined);

  private defaultConfig: KanbanConfig = {
    columns: []
  };

  constructor() {
    effect(() => {
      this.ext();
      untracked(() => this.loadExt());
    });
    effect(() => {
      this.query();
      this.ext();
      this.pageControls();
      this.fullPage();
      this.size();
      this.sort();
      this.filter();
      this.search();
      untracked(() => this.onResize());
    });
  }

  saveChanges() {
    return !this.list().find(r => !r.saveChanges());
  }

  private loadExt() {
    this.preloadExts();
  }


  private readonly onDestroy = inject(DestroyRef).onDestroy(() => {
    this.updates.complete();
  });

  onResize() {
    const margin = 20;
    const minColSize = 320;
    const sidebarSize = 354;
    this.store.view.floatingSidebar.set(innerWidth - sidebarSize < margin + minColSize * (this.columns().length + (this.showColumnBacklog() ? 1 : 0)));
  }

  readonly disableSwimLanes = computed(() => this.swimLanesOverride() ?? !!this.kanbanConfig().hideSwimLanes);

  readonly columns = computed((): string[] => {
    if (this.filteredColumnBacklog()) return [];
    const filteredColumn = this.filteredColumn();
    if (filteredColumn) return [filteredColumn];
    if (!this.kanbanConfig().columns) return this.ext() ? [this.ext()!.tag] : [];
    return without(this.kanbanConfig().columns, ...this.negateFilters());
  });

  readonly swimLanes = computed((): string[] | undefined => {
    if (this.disableSwimLanes()) return undefined;
    if (!this.kanbanConfig().swimLanes?.length) return undefined;
    if (this.filteredSwimLaneBacklog()) return [];
    const filteredSwimLane = this.filteredSwimLane();
    if (filteredSwimLane) return [filteredSwimLane];
    return without(this.kanbanConfig().swimLanes, ...this.negateFilters());
  });

  readonly andColBacklog = computed(() => ':' + this.colBacklog());

  readonly andSlBacklog = computed(() => {
    if (this.disableSwimLanes()) return '';
    if (!this.kanbanConfig().swimLanes?.length) return '';
    return ':' + this.slBacklog();
  });

  readonly colBacklog = computed(() => {
    const columns = this.kanbanConfig().columns;
    if (!columns?.length) return '';
    return columns.map(t => t.startsWith('!') ? t.substring(1) : ('!' + t)).join(':');
  });

  readonly slBacklog = computed(() => {
    if (this.disableSwimLanes()) return '';
    const swimLanes = this.kanbanConfig().swimLanes;
    if (!swimLanes?.length) return '';
    return swimLanes.map(t => t.startsWith('!') ? t.substring(1) : ('!' + t)).join(':');
  });

  readonly kanbanConfig = computed((): KanbanConfig => {
    return this.ext()?.config || this.defaultConfig;
  });

  readonly queryTags = computed((): string[] => {
    return uniq([
      ...topAnds(this.query()).filter(t => !isQuery(t)),
      ...this.filter()
        .filter(f => f.startsWith('query/'))
        .filter(f => !f.startsWith('query/!('))
        .map(f => f.substring('query/'.length)),
    ]);
  });

  readonly negateFilters = computed((): string[] => {
    // TODO: evaluate queries
    return uniq([
      ...topAnds(this.query()).filter(t => isSelector(t))
        .map(f => f.startsWith('!') ? f.substring(1) : '!' + f),
      ...this.filter()
        .filter(f => f.startsWith('query/'))
        .flatMap(f => f.startsWith('query/!(')
          ? [f.substring('query/!('.length, f.length - 1)]
          : topAnds(negate(f.substring('query/'.length)))),
    ]);
  });

  readonly filteredColumn = computed(() => {
    const cols = this.kanbanConfig().columns || [this.ext()?.tag];
    for (const tag of this.queryTags()) {
      if (cols.includes(tag)) return tag;
    }
    return undefined;
  });

  readonly filteredColumnBacklog = computed(() => {
    for (const tag of this.queryTags()) {
      if (this.colBacklog() === tag) return true;
    }
    return false;
  });

  readonly filteredSwimLane = computed(() => {
    const swimLanes = this.kanbanConfig().swimLanes;
    if (!swimLanes) return undefined;
    for (const tag of this.queryTags()) {
      if (swimLanes.includes(tag)) return tag;
      if (this.slBacklog() === tag) return tag;
    }
    return undefined;
  });

  readonly filteredSwimLaneBacklog = computed(() => {
    if (!this.kanbanConfig().swimLanes) return false;
    for (const tag of this.queryTags()) {
      if (this.slBacklog() === tag) return true;
    }
    return false;
  });

  readonly showColumnBacklog = computed(() => {
    if (this.negateFilters().includes(this.colBacklog())) return false;
    if (this.filteredColumnBacklog()) return true;
    if (this.filteredColumn()) return false;
    return this.kanbanConfig().showColumnBacklog;
  });

  readonly showSwimLaneBacklog = computed(() => {
    if (this.negateFilters().includes(this.slBacklog())) return false;
    if (this.filteredSwimLaneBacklog()) return true;
    if (this.filteredSwimLane()) return false;
    return this.kanbanConfig().showSwimLaneBacklog;
  });

  preloadExts() {
    this.exts.getCachedExts([
      ...this.kanbanConfig().columns || [],
      ...this.kanbanConfig().swimLanes || [],
      ...this.kanbanConfig().badges || [],
    ]).subscribe();
  }

  /**
   * Tags to apply to new Refs created on the board.
   */
  addingTags(tags: { col?: string, sl?: string }) {
    const result = [
      ...this.kanbanConfig().addTags || [],
      ...this.store.view.queryTags().map(localTag),
    ];
    result.push(this.ext()!.tag);
    if (tags.col) result.push(tags.col);
    if (tags.sl) result.push(tags.sl);
    return uniq(result);
  }

  getQuery(tags?: { col?: string, sl?: string }) {
    if (!tags) return '';
    const cols =  tags.col ? ':' + tags.col : this.andColBacklog();
    const sl =  tags.sl ? ':' + tags.sl : this.andSlBacklog();
    return '(' + this.query() + ')' + cols + sl;
  }

  drop(event: CdkDragDrop<{ sl?: string, col?: string }>) {
    const originalRef = event.item.data as Ref;
    const from = Object.values(event.previousContainer.data);
    const to = Object.values(event.container.data || {});
    const remove = from.filter(t => !to.includes(t));
    const add = to.filter(t => !from.includes(t));

    // Optimistically update, revert in case of error
    const ref: Ref = {
      ...originalRef,
      tags: [...(originalRef.tags || []).filter(t => !remove.includes(t)), ...add],
    };
    this.updates.next({
      from: this.getQuery(event.previousContainer.data),
      to: this.getQuery(event.container.data),
      ref,
      index: event.currentIndex,
    });
    if (this.store.view.lastSelected()?.url === ref.url) {
      this.store.view.clearLastSelected();
    }

    const tags = [...remove.map(t => `-${t}`), ...add];
    if (!tags.length) return;
    this.tags.patch(tags, ref.url, ref.origin).pipe(
      tap(cursor => this.accounts.clearNotificationsIfNone(DateTime.fromISO(cursor))),
      catchError(() => {
        // Revert
        this.updates.next({
          from: this.getQuery(event.container.data),
          to: this.getQuery(event.previousContainer.data),
          ref: originalRef,
          index: event.previousIndex,
        });
        return of(null);
      }),
    ).subscribe();
  }

}
