import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { catchError, of, Subject } from 'rxjs';
import { Ext } from '../../model/ext';
import { Ref } from '../../model/ref';
import { ExtService } from '../../service/api/ext.service';
import { TaggingService } from '../../service/api/tagging.service';

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

  ext?: Ext;
  disableSwimLanes = false;
  error: any;
  updates = new Subject<KanbanDrag>();

  constructor(
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
    this.exts.get(value).pipe(
      catchError(err => {
        this.error = err;
        return of(undefined);
      }),
    ).subscribe(ext => this.ext = ext);
  }

  get swimLanes() {
    if (this.disableSwimLanes) return undefined;
    if (!this.ext?.config.swimLanes) return undefined;
    if (!this.ext?.config.swimLanes.length) return undefined;
    return this.ext?.config.swimLanes;
  }

  drop(event: CdkDragDrop<string[]>) {
    const ref = event.item.data as Ref;
    const from = event.previousContainer.data;
    const to = event.container.data;
    const both = _.intersection(from, to);
    const remove = _.filter(from, t => !both.includes(t));
    const add = _.filter(to, t => !both.includes(t));

    // Optimistically update, revert in case of error
    ref.tags = _.filter(ref.tags, t => !remove.includes(t));
    for (const t of add) ref.tags.push(t);
    this.updates.next({
      from: this.ext!.tag + ':' + from.join(':'),
      to: this.ext!.tag + ':' + to.join(':'),
      ref,
      index: event.currentIndex,
    });

    const tags = [...remove.map(t => `-${t}`), ...add];
    if (!tags.length) return;
    this.tags.patch(tags, ref.url, ref.origin).pipe(
      catchError(() => {
        // Revert
        this.updates.next({
          from: this.ext!.tag + ':' + to.join(':'),
          to: this.ext!.tag + ':' + from.join(':'),
          ref,
          index: event.previousIndex,
        });
        return of(null);
      }),
    ).subscribe();
  }

}
