import { Component, Input, OnInit } from '@angular/core';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss']
})
export class KanbanColumnComponent implements OnInit {

  _query?: string;
  size = 20;
  pages: Page<Ref>[] = [];

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
  }

  @Input()
  set query(value: string) {
    if (this._query === value) return;
    this._query = value;
    this.loadMore();
  }

  loadMore() {
    this.refs.page({
      query: this._query,
      page: this.pages.length,
      size: this.size,
    }).subscribe(page => {
      this.pages.push(page);
    });
  }

}
