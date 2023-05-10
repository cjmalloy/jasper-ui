import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { AuthzService } from '../../../service/authz.service';

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
    private scraper: ScrapeService,
  ) { }

  ngOnInit(): void {
  }

  cssUrl(url: string) {
    if (!url) return '';
    if (this.admin.status.plugins.thumbnail?.config?.cache) {
      url = this.scraper.getFetch(url);
    }
    return `url('${url}')`;
  }

  @HostBinding('class.no-write')
  get noWrite() {
    return !this.auth.writeAccess(this.ref);
  }

}
