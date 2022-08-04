import { Component, Input, OnInit } from '@angular/core';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-kanban-card',
  templateUrl: './kanban-card.component.html',
  styleUrls: ['./kanban-card.component.scss']
})
export class KanbanCardComponent implements OnInit {

  @Input()
  ref!: Ref;

  constructor(
    private admin: AdminService,
  ) { }

  ngOnInit(): void {
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }

  get person() {
    return this.admin.status.plugins.person &&
      this.ref.tags?.includes('plugin/person');
  }

}
