import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, forkJoin, of } from 'rxjs';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { RefService } from '../../service/api/ref.service';
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
    private refs: RefService,
    private exts: ExtService,
  ) { }

  ngOnInit(): void {
    this.store.view.clear(
      !!this.admin.status.plugins.voteUp ? 'voteScoreDecay'
        : this.store.view.tag.includes('*') ? 'published'
        : 'created');
    runInAction(() => this.store.view.extTemplates = this.admin.tmplView);
    this.disposers.push(autorun(() => {
      const hideInternal = !isPlugin(this.store.view.tag) && !this.admin.getTemplates(this.store.view.tag).find(t => t.config?.internal);
      const args = getArgs(
        this.store.view.tag,
        this.store.view.sort,
        hideInternal ? uniq(['query/!internal', ...this.store.view.filter]) as UrlFilter[] : this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      this.theme.setTitle(this.store.view.name);
      if (!this.store.view.queryTags.length) {
        runInAction(() => this.store.view.exts = []);
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
    this.disposers.push(autorun(() => {
      this.floatingSidebar = !this.store.view.hasTemplate || this.store.view.isTemplate('map') || this.store.view.isTemplate('graph');
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  cssClass(tag: string) {
    return tag.replace(/\//g, '-')
      .replace(/[^\w-]/g, '');
  }
}
