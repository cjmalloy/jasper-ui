import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { BookmarkService } from '../../service/bookmark.service';
import { ModService } from '../../service/mod.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs, UrlFilter } from '../../util/query';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
})
export class TagPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

  @HostBinding('class.no-footer-padding')
  get noFooterPadding() {
    return this.store.view.isTemplate('kanban');
  }

  loading = true;

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
        !!this.admin.getPlugin('plugin/vote/up')
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
            runInAction(() => this.store.view.exts = exts);
            this.loading = false;
        });
      }
    }));
  }

  ngOnInit() {
    this.disposers.push(autorun(() => {
      const hideInternal = !this.admin.getPlugins(this.store.view.queryTags).find(t => t.config?.internal);
      const filters = this.store.view.filter.length ? this.store.view.filter : this.store.view.viewExtFilter;
      if (!this.store.view.filter.length && this.store.view.viewExtFilter?.length) {
        this.bookmarks.filters = this.store.view.viewExtFilter;
      }
      const args = getArgs(
        this.store.view.tag,
        this.store.view.sort,
        uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete'] : ['query/!plugin/delete'], ...filters || []]) as UrlFilter[],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }
}
