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
    private store: Store,
    private exts: ExtService,
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
    return this.ext?.config.columns;
  }

  get swimLanes(): string[] | undefined {
    if (this.disableSwimLanes) return undefined;
    if (!this.ext?.config.swimLanes) return undefined;
    if (!this.ext?.config.swimLanes.length) return undefined;
    return this.ext?.config.swimLanes;
  }

  /**
   * Tags to apply to new Refs created on the board.
   */
  addingTags(tags: { col?: string, sl?: string }) {
    const result = [];
    if (!this.ext!.tag.startsWith('_')) {
      result.push('public');
    }
    result.push(this.ext!.tag);
    if (tags.col) result.push(tags.col);
    if (tags.sl) result.push(tags.sl);
    return uniq(result);
  }

  getQuery(tags: { col?: string, sl?: string }) {
    if (!tags) return '';
    const kanbanTag = defaultOrigin(this.ext!.tag, this.store.account.origin);
    const columns = this.ext!.config.columns;
    const swimLanes = this.swimLanes;
    const sl = tags.sl;
    const col = tags.col;
    if (swimLanes) {
      if (!col && !sl) {
        return kanbanTag + ':!' + columns.join(':!') + ':!' + swimLanes.join(':!');
      }
      if (!col) {
        return kanbanTag + ':' + sl + ':!' + columns.join(':!');
      }
      if (!sl) {
        return kanbanTag + ':' + col + ':!' + swimLanes.join(':!');
      }
      return kanbanTag + ':' + col + ':' + sl;
    } else {
      if (!col) {
        return kanbanTag + ':!' + columns.join(':!');
      }
      return kanbanTag + ':' + col;
    }
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
