import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { AuthzService } from '../../../service/authz.service';
import { hasComment, trimCommentForTitle } from '../../../util/format';
import { hasTag } from '../../../util/tag';

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

  get repost() {
    return this.ref?.sources?.length && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get title() {
    const title = (this.ref?.title || '').trim();
    const comment = (this.ref?.comment || '').trim();
    if (title) return title;
    if (!comment) {
      if (this.bareRepost) return $localize`Repost`;
      return this.url;
    }
    return trimCommentForTitle(comment);
  }

  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  get currentText() {
    const value = this.ref?.comment || '';
    if (this.ref?.title || hasComment(this.ref?.comment)) return value;
    return '';
  }

}
