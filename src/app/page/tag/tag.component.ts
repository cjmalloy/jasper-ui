import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, of } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ThemeService } from '../../service/theme.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs, UrlFilter } from '../../util/query';
import { isPlugin } from '../../util/tag';

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

  floatingSidebar = true;
  loading = true;

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private theme: ThemeService,
    private exts: ExtService,
  ) {
    this.disposers.push(autorun(() => this.theme.setTitle(this.store.view.name)));
    this.disposers.push(autorun(() => {
      this.floatingSidebar = this.store.view.list || !this.store.view.hasTemplate || this.store.view.isTemplate('map') || this.store.view.isTemplate('graph');
    }));
    runInAction(() => {
      this.store.view.clear(
        !!this.admin.getPlugin('plugin/vote/up') ? 'voteScoreDecay'
          : this.store.view.tag.includes('*') ? 'published'
          : 'created');
      this.store.view.extTemplates = this.admin.tmplView;
    });
    this.disposers.push(autorun(() => {
      if (!this.store.view.queryTags.length) {
        runInAction(() => this.store.view.exts = []);
        this.loading = false;
      } else {
        this.loading = true;
        this.exts.getCachedExts(this.store.view.queryTags).pipe(
          catchError(() => of([])),
        ).subscribe(exts => {
          this.loading = false;
          runInAction(() => this.store.view.exts = exts)
        });
      }
    }));
  }

  ngOnInit() {
    this.disposers.push(autorun(() => {
      const hideInternal = !isPlugin(this.store.view.tag) && !this.admin.getTemplates(this.store.view.tag).find(t => t.config?.internal);
      const args = getArgs(
        this.store.view.tag,
        this.store.view.sort,
        uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete'] : ['query/!plugin/delete'], ...this.store.view.filter]) as UrlFilter[],
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
