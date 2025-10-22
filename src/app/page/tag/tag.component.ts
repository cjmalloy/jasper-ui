import { Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { isEqual, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { LensComponent } from '../../component/lens/lens.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { BookmarkService } from '../../service/bookmark.service';
import { ModService } from '../../service/mod.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs, UrlFilter } from '../../util/query';
import { MobxAngularModule } from 'mobx-angular';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { RouterLink } from '@angular/router';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { LoadingComponent } from '../../component/loading/loading.component';

@Component({
    selector: 'app-tag-page',
    templateUrl: './tag.component.html',
    styleUrls: ['./tag.component.scss'],
    imports: [
        MobxAngularModule,
        TabsComponent,
        RouterLink,
        SidebarComponent,
        LensComponent,
        LoadingComponent,
    ],
})
export class TagPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];

  loading = true;

  @ViewChild(LensComponent)
  lens?: LensComponent;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private mod: ModService,
    private exts: ExtService,
    private bookmarks: BookmarkService,
  ) {
    this.disposers.push(autorun(() => this.mod.setTitle(this.store.view.name)));
    runInAction(() => {
      this.store.view.clear([
        !!this.admin.getPlugin('plugin/user/vote/up')
        ? 'voteScoreDecay'
        : this.store.view.tag.includes('*')
        ? 'published'
        : 'created'
      ]);
      this.store.view.extTemplates = this.admin.view;
    });
    this.disposers.push(autorun(() => {
      if (!this.store.view.queryTags.length) {
        runInAction(() => this.store.view.exts = []);
        this.loading = false;
      } else {
        this.loading = true;
        this.exts.getCachedExts(this.store.view.queryTags)
          .pipe(this.admin.extFallbacks)
          .subscribe(exts => {
            if (!isEqual(exts.map(x => x.tag + x.origin + x.modifiedString).sort(), this.store.view.exts.map(x => x.tag + x.origin + x.modifiedString).sort())) {
              runInAction(() => this.store.view.exts = exts);
            }
            this.loading = false;
        });
      }
    }));
    this.query.clear();
  }

  saveChanges() {
    return !this.lens || this.lens.saveChanges();
  }

  ngOnInit() {
    this.disposers.push(autorun(() => {
      const filters = this.store.view.filter.length ? this.store.view.filter : this.store.view.viewExtFilter;
      if (!this.store.view.filter.length && this.store.view.viewExtFilter?.length) {
        this.bookmarks.filters = this.store.view.viewExtFilter;
      }
      const hideInternal = !this.admin.getPlugins(this.store.view.queryTags).length;
      const args = getArgs(
        this.store.view.tag,
        this.store.view.sort,
        uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete', 'user/!plugin/user/hide'] : ['query/!plugin/delete', 'user/!plugin/user/hide'], ...filters || []]) as UrlFilter[],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      runInAction(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  @HostBinding('class.no-footer-padding')
  get noFooterPadding() {
    return this.store.view.isTemplate('kanban');
  }
}
