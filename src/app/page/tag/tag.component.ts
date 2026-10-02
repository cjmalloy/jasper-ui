import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, viewChild, effect, inject, Injector, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isEqual, uniq } from 'lodash-es';
import { LensComponent } from '../../component/lens/lens.component';
import { LoadingComponent } from '../../component/loading/loading.component';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { BookmarkService } from '../../service/bookmark.service';
import { ModService } from '../../service/mod.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { getArgs, UrlFilter } from '../../util/query';
import { hasPrefix, localTag } from '../../util/tag';

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
  host: {
    '[class.no-footer-padding]': 'noFooterPadding',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LensComponent,
    TabsComponent,
    RouterLink,
    SidebarComponent,
    LoadingComponent,
  ],
})
export class TagPage implements OnInit, OnDestroy, HasChanges {

  private readonly injector = inject(Injector);

  readonly loading = signal<boolean>(false);

  readonly lens = viewChild<LensComponent>('lens');

  constructor(
    public admin: AdminService,
    public account: AccountService,
    public store: Store,
    public query: QueryStore,
    private mod: ModService,
    private exts: ExtService,
    private bookmarks: BookmarkService,
  ) {
    effect(() => this.mod.setTitle(this.store.view.name()), { injector: this.injector });
    {
      this.store.view.clear([
        !!this.admin.getPlugin('plugin/user/vote/up')
          ? 'plugins->plugin/user/vote:decay'
          : this.store.view.tag().includes('*')
            ? 'published'
            : 'created'
      ]);
      this.store.view.extTemplates.set(this.admin.view);
    };
    effect(() => {
      this.store.view.urlQueryTags();
      untracked(() => {
        if (!this.store.view.urlQueryTags().length) {
          this.store.view.exts.set([]);
          this.loading.set(false);
        } else {
          this.loading.set(true);
          this.exts.getCachedExts(this.store.view.urlQueryTags())
            .pipe(this.admin.extFallbacks)
            .subscribe(exts => {
              if (!isEqual(exts.map(x => x.tag + x.origin + x.modifiedString).sort(), this.store.view.exts().map(x => x.tag + x.origin + x.modifiedString).sort())) {
                this.store.view.exts.set(exts);
              }
              this.loading.set(false);
            });
        }
      });
    }, { injector: this.injector });
    this.query.clear();
  }

  saveChanges() {
    const lens = this.lens();
    return !lens || lens.saveChanges();
  }

  ngOnInit() {
    effect(() => {
      const filters = this.store.view.filter().length ? this.store.view.filter() : this.store.view.viewExtFilter();
      if (!this.store.view.filter().length && this.store.view.viewExtFilter()?.length) {
        const viewExtFilter = this.store.view.viewExtFilter();
        untracked(() => this.bookmarks.filters = viewExtFilter);
      }
      const hideInternal = !this.admin.getPlugins(this.store.view.queryTags().map(localTag)).length;
      const args = getArgs(
        this.store.view.tag(),
        this.store.view.sort(),
        uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete', 'user/!plugin/user/hide'] : ['query/!plugin/delete', 'user/!plugin/user/hide'], ...filters || []]) as UrlFilter[],
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      );
      if (hasPrefix(this.store.view.viewExt()?.tag, 'kanban') ||
          hasPrefix(this.store.view.viewExt()?.tag, 'chat')) {
        untracked(() => this.query.setRelatedArgs(args));
        return;
      }
      untracked(() => this.query.setArgs(args));
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.query.close();
  }

  get noFooterPadding() {
    return this.store.view.isTemplate('kanban');
  }
}
