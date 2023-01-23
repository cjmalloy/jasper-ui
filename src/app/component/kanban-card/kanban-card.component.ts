import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-kanban-card',
  templateUrl: './kanban-card.component.html',
  styleUrls: ['./kanban-card.component.scss']
})
export class KanbanCardComponent implements OnInit {
  @HostBinding('class') css = 'kanban-card';

  @Input()
  ref!: Ref;

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) { }

  ngOnInit(): void {
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }

  @HostBinding('class.no-write')
  get noWrite() {
    return !this.auth.writeAccess(this.ref);
  }

  get person() {
    return this.admin.status.plugins.person &&
      hasTag('plugin/person', this.ref);
  }

  get routerLink() {
    const route = ['/ref', this.ref.url];
    if (this.admin.status.plugins.comment) {
      route.push('comments');
    }
    return route;
  }

}
