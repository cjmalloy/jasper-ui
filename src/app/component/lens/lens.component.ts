import { Component, Input, OnChanges, QueryList, SimpleChanges, ViewChildren } from '@angular/core';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { QueryStore } from '../../store/query';
import { UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';
import { RefComponent } from '../ref/ref.component';
import { ForceDirectedComponent } from '../graph/force-directed/force-directed.component';
import { NotebookComponent } from '../notebook/notebook.component';
import { KanbanComponent } from '../kanban/kanban.component';
import { BlogComponent } from '../blog/blog.component';
import { ChatComponent } from '../chat/chat.component';
import { FolderComponent } from '../folder/folder.component';
import { RefListComponent } from '../ref/ref-list/ref-list.component';

@Component({
    selector: 'app-lens',
    templateUrl: './lens.component.html',
    styleUrls: ['./lens.component.scss'],
    imports: [RefComponent, ForceDirectedComponent, NotebookComponent, KanbanComponent, BlogComponent, ChatComponent, FolderComponent, RefListComponent]
})
export class LensComponent implements OnChanges, HasChanges {

  @Input()
  ext?: Ext;
  @Input()
  tag = '';
  @Input()
  fullPage = false;
  @Input()
  cols? = 0;
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

  plugins?: string[];

  @ViewChildren('lens')
  list?: QueryList<HasChanges>;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public query: QueryStore,
  ) { }

  saveChanges() {
    return !this.list?.find(t => !t.saveChanges());
  }

  init() {
    if (hasPrefix(this.ext?.tag, 'plugin')) {
      this.plugins = [this.ext!.tag];
    } else {
      this.plugins = undefined;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ext) {
      this.init();
    }
  }

  isTemplate(template: string) {
    return hasPrefix(this.ext?.tag, template);
  }

  cssClass(tag?: string) {
    if (!tag) return '';
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-]/g, '');
  }
}
