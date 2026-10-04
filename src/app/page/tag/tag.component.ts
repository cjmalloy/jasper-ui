import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { uniq } from 'lodash-es';
import { LensComponent } from '../../component/lens/lens.component';
import { LoadingComponent } from '../../component/loading/loading.component';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
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
    '[class.no-footer-padding]': "noFooterPadding()",
  },
  imports: [
    LensComponent,
    TabsComponent,
    RouterLink,
    SidebarComponent,
    LoadingComponent,
  ],
})
export class TagPage implements HasChanges {
  admin = inject(AdminService);
  account = inject(AccountService);
  store = inject(Store);
  query = inject(QueryStore);
  private mod = inject(ModService);
  private exts = inject(ExtService);


  readonly lens = viewChild<LensComponent>('lens');

  constructor() {
    // Sync the document title
    effect(() => this.mod.setTitle(this.store.view.name()));
    this.store.view.clear([
      !!this.admin.getPlugin('plugin/user/vote/up')
        ? 'plugins->plugin/user/vote:decay'
        : this.store.view.tag().includes('*')
          ? 'published'
          : 'created'
    ]);
    this.store.view.extTemplates.set(this.admin.view());
    this.store.view.watchExts(() => this.queryExts.hasValue() ? this.queryExts.value() : []);
    this.query.watch(() => this.related() ? undefined : this.args());
    this.query.watchRelated(() => this.related() ? this.args() : undefined);
  }

  private readonly queryExts = rxResource({
    params: () => this.store.view.urlQueryTags().length ? this.store.view.urlQueryTags() : undefined,
    stream: ({ params }) => this.exts.getCachedExts(params).pipe(this.admin.extFallbacks),
  });

  readonly loading = computed(() => this.queryExts.isLoading());

  private readonly related = computed(() =>
    hasPrefix(this.store.view.viewExt()?.tag, 'kanban') ||
    hasPrefix(this.store.view.viewExt()?.tag, 'chat'));

  private readonly args = computed(() => {
    const filters = this.store.view.filter().length ? this.store.view.filter() : this.store.view.viewExtFilter();
    const hideInternal = !this.admin.getPlugins(this.store.view.queryTags().map(localTag)).length;
    return getArgs(
      this.store.view.tag(),
      this.store.view.sort(),
      uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete', 'user/!plugin/user/hide'] : ['query/!plugin/delete', 'user/!plugin/user/hide'], ...filters || []]) as UrlFilter[],
      this.store.view.search(),
      this.store.view.pageNumber(),
      this.store.view.pageSize(),
    );
  });

  saveChanges() {
    const lens = this.lens();
    return !lens || lens.saveChanges();
  }

  readonly noFooterPadding = computed(() => {
    return this.store.view.isTemplate('kanban');
  });
}
