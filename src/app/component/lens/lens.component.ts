import { Component, Input } from '@angular/core';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { QueryStore } from '../../store/query';
import { UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';

@Component({
  selector: 'app-lens',
  templateUrl: './lens.component.html',
  styleUrls: ['./lens.component.scss']
})
export class LensComponent {

  @Input()
  ext?: Ext;
  @Input()
  tag = '';
  @Input()
  cols = 0;
  @Input()
  size = 24;
  @Input()
  sort: RefSort[] = [];
  @Input()
  filter: UrlFilter[] = [];
  @Input()
  search = '';
  @Input()
  page?: Page<Ref>;
  @Input()
  pageControls = true;
  @Input()
  showAlarm = true;
  @Input()
  showVotes = false;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public query: QueryStore,
  ) { }

  isTemplate(template: string) {
    return hasPrefix(this.ext?.tag, template);
  }

  cssClass(tag?: string) {
    if (!tag) return '';
    return tag.replace(/\//g, '-')
      .replace(/[^\w-]/g, '');
  }
}
