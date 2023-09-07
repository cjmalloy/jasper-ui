import { Component, Input } from '@angular/core';
import { Store } from '../../store/store';
import { AdminService } from '../../service/admin.service';
import { AccountService } from '../../service/account.service';
import { QueryStore } from '../../store/query';
import { ThemeService } from '../../service/theme.service';
import { ExtService } from '../../service/api/ext.service';
import { hasPrefix } from '../../util/tag';
import { Ext } from '../../model/ext';
import { Ref } from '../../model/ref';
import { Page } from '../../model/page';

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
  page?: Page<Ref>;
  @Input()
  showAlarm = true;
  @Input()
  showVotes = false;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
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
