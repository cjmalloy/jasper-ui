import { Component, computed, forwardRef, input, viewChildren, inject } from '@angular/core';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { QueryStore } from '../../store/query';
import { UrlFilter } from '../../util/query';
import { hasPrefix } from '../../util/tag';
import { BlogComponent } from '../blog/blog.component';
import { ChatComponent } from '../chat/chat.component';
import { FolderComponent } from '../folder/folder.component';
import { ForceDirectedComponent } from '../graph/force-directed/force-directed.component';
import { GridComponent } from '../grid/grid.component';
import { KanbanComponent } from '../kanban/kanban.component';
import { LoadingComponent } from '../loading/loading.component';
import { MapComponent } from '../map/map.component';
import { NotebookComponent } from '../notebook/notebook.component';
import { RefListComponent } from '../ref/ref-list/ref-list.component';
import { RefComponent } from '../ref/ref.component';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-lens',
  templateUrl: './lens.component.html',
  styleUrls: ['./lens.component.scss'],
  imports: [
    LoadingComponent,
    forwardRef(() => RefComponent),
    forwardRef(() => ForceDirectedComponent),
    forwardRef(() => BlogComponent),
    forwardRef(() => ChatComponent),
    forwardRef(() => FolderComponent),
    forwardRef(() => RefListComponent),
    forwardRef(() => KanbanComponent),
    forwardRef(() => NotebookComponent),
    forwardRef(() => GridComponent),
    forwardRef(() => MapComponent),
    ViewerComponent,
  ],
})
export class LensComponent implements HasChanges {
  admin = inject(AdminService);
  account = inject(AccountService);
  query = inject(QueryStore);


  readonly ext = input<Ext | undefined>();
  readonly tag = input('');
  readonly fullPage = input(false);
  readonly cols = input(0);
  readonly size = input(24);
  readonly sort = input<RefSort[]>([]);
  readonly filter = input<UrlFilter[]>([]);
  readonly search = input('');
  readonly page = input<Page<Ref> | undefined>();
  readonly pageControls = input(true);
  readonly showAlarm = input(true);
  readonly showVotes = input(false);

  readonly plugins = computed(() => hasPrefix(this.ext()?.tag, 'plugin') ? [this.ext()!.tag] : undefined);
  readonly header = computed(() => this.ext()?.config?.header);

  readonly list = viewChildren<HasChanges>('lens');

  saveChanges() {
    return !this.list()?.find(t => !t.saveChanges());
  }

  isTemplate(template: string) {
    return this.admin.getTemplate(template) && hasPrefix(this.ext()?.tag, template);
  }

  cssClass(tag?: string) {
    if (!tag) return '';
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-]/g, '');
  }
}
