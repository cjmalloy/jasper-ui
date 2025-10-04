import { Component, HostBinding, OnInit, ViewChild, ChangeDetectionStrategy, effect } from '@angular/core';
import { isEqual, uniq } from 'lodash-es';
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

@Component({
  standalone: false,
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagPage implements OnInit, HasChanges {

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
    effect(() => this.mod.setTitle(this.store.view.name));
    this.store.view.clear([
      !!this.admin.getPlugin('plugin/user/vote/up')
      ? 'voteScoreDecay'
      : this.store.view.tag.includes('*')
      ? 'published'
      : 'created'
    ]);
    this.store.view.extTemplates = this.admin.view;
    effect(() => {
      if (!this.store.view.queryTags.length) {
        this.store.view.exts = [];
        this.loading = false;
      } else {
        this.loading = true;
        this.exts.getCachedExts(this.store.view.queryTags)
          .pipe(this.admin.extFallbacks)
          .subscribe(exts => {
            if (!isEqual(exts.map(x => x.tag + x.origin + x.modifiedString).sort(), this.store.view.exts.map(x => x.tag + x.origin + x.modifiedString).sort())) {
              this.store.view.exts = exts;
            }
            this.loading = false;
        });
      }
    });
    this.query.clear();
  }

  saveChanges() {
    return !this.lens || this.lens.saveChanges();
  }

  ngOnInit() {
    effect(() => {
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
      this.query.setArgs(args);
    });
  }

  @HostBinding('class.no-footer-padding')
  get noFooterPadding() {
    return this.store.view.isTemplate('kanban');
  }
}
