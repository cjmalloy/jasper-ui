import { AfterViewInit, Component, HostBinding, Input, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { v4 as uuid } from 'uuid';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
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

  _query?: string;
  size = 20;
  pages: Page<Ref>[] = [];
  mutated = false;
  addText = '';

  constructor(
    private refs: RefService,
  ) { }

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
    this.loadMore();
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
    this.refs.page({
      query: this._query,
      page: this.pages.length,
      size: this.size,
    }).subscribe(page => {
      this.pages.push(page);
    });
  }

  add() {
    if (!this.addText) return;
    const ref = {
      url: 'comment:' + uuid(),
      title: this.addText,
      tags: this._query?.split(':'),
    };
    this.refs.create(ref).subscribe(() => {
      this.mutated = true;
      this.pages[this.pages.length - 1].content.push(ref)
    });
    this.addText = '';
  }

  private refreshPage(i: number) {
    this.refs.page({
      query: this._query,
      page: i,
      size: this.size,
    }).subscribe(page => {
      this.pages[i] = page;
    });
  }
}
