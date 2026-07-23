import { Component, forwardRef, Input, OnChanges, OnDestroy, QueryList, SimpleChanges, ViewChildren, ChangeDetectionStrategy } from '@angular/core';
import { MobxAngularModule } from 'mobx-angular';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    MobxAngularModule,
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
export class LensComponent implements OnChanges, OnDestroy, HasChanges {

  @Input()
  ext?: Ext;
  private _pinnedExt?: Ext;
  private pinnedRequest?: Subscription;

  @Input()
  set pinnedExt(value: Ext | undefined) {
    this._pinnedExt = value;
    this.loadPinned();
  }

  get pinnedExt() {
    return this._pinnedExt;
  }

  get pinsExt() {
    return this.pinnedExt || this.ext;
  }
  @Input()
  tag = '';
  @Input()
  fullPage = false;
  @Input()
  listView = false;
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
  header?: string;
  pinnedPage = Page.of<Ref>([]);

  @ViewChildren('lens')
  list?: QueryList<HasChanges>;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public query: QueryStore,
    private refs: RefService,
  ) { }

  saveChanges() {
    return !this.list?.find(t => !t.saveChanges());
  }

  init() {
    this.header = this.ext?.config?.header;
    if (hasPrefix(this.ext?.tag, 'plugin')) {
      this.plugins = [this.ext!.tag];
    } else {
      this.plugins = undefined;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ext) {
      this.init();
      if (!this.pinnedExt) this.loadPinned();
    }
  }

  ngOnDestroy() {
    this.pinnedRequest?.unsubscribe();
  }

  loadPinned() {
    this.pinnedRequest?.unsubscribe();
    this.pinnedPage = Page.of<Ref>([]);
    const pinned = this.pinsExt?.config?.pinned as string[] | undefined;
    if (!pinned?.length) return;
    this.pinnedRequest = forkJoin(pinned.map(url =>
      this.refs.getCurrent(url).pipe(catchError(() => of({ url })))
    )).subscribe(refs => this.pinnedPage = Page.of(refs));
  }

  isTemplate(template: string) {
    return !this.listView && this.admin.getTemplate(template) && hasPrefix(this.ext?.tag, template);
  }

  cssClass(tag?: string) {
    if (!tag) return '';
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-]/g, '');
  }
}
