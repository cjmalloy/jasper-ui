import { Component, forwardRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { ExtListComponent } from '../../component/ext/ext-list/ext-list.component';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { ModService } from '../../service/mod.service';
import { ExtStore } from '../../store/ext';
import { Store } from '../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../util/query';
import { braces, getPrefixes, hasPrefix, publicTag } from '../../util/tag';

@Component({
  selector: 'app-tags-page',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss'],
  imports: [
    forwardRef(() => ExtListComponent),
    MobxAngularModule,
    TabsComponent,
    RouterLink,
    SidebarComponent,
  ]
})
export class TagsPage implements OnInit, OnDestroy, HasChanges {

  private disposers: IReactionDisposer[] = [];

  title = '';
  templates = this.admin.tmplSubmit.filter(t => t.config?.view);

  @ViewChild(ExtListComponent)
  list?: ExtListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: ExtStore,
    private auth: AuthzService,
    private exts: ExtService,
  ) {
    mod.setTitle($localize`Tags`);
    store.view.clear(['levels', 'tag'], ['levels', 'tag']);
    query.clear();
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.title = this.store.view.template && this.admin.getTemplate(this.store.view.template)?.name || this.store.view.ext?.name || this.store.view.template || '';
      this.exts.getCachedExt(this.store.view.template)
        .subscribe(ext => this.title = ext.name || this.title);
      const query
        = this.store.view.home
        ? [...getPrefixes('home'), ...this.store.account.subs, ...this.store.account.bookmarks].filter(t => this.auth.tagReadAccess(t)).join('|')
        : this.store.view.noTemplate
          ? [braces(this.store.view.template), '!+user', '!_user', ...this.templates.map(t => '!' + t.tag).flatMap(getPrefixes)].filter(t => this.auth.tagReadAccess(t)).join(':')
          : this.store.view.template
            ? (publicTag(this.store.view.template)
              ? getPrefixes(this.store.view.template).filter(t => this.auth.tagReadAccess(t)).join('|')
              : this.store.view.template)
            : '@*';
      const args = {
        query: getTagQueryFilter(braces(query), this.store.view.filter) + (!this.store.view.showRemotes ? ':' + (this.store.account.origin || '*') : ''),
        search: this.store.view.search,
        sort: [...this.store.view.sort],
        page: this.store.view.pageNumber,
        size: this.store.view.pageSize,
        ...getTagFilter(this.store.view.filter),
      };
      defer(() => this.query.setArgs(args));
    }));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  templateIs(tag: string): boolean {
    return hasPrefix(this.store.view.localTemplate, tag);
  }

  get templateExists(): boolean {
    if (this.store.view.localTemplate === 'user') return true;
    return !!this.templates.find(t => hasPrefix(this.store.view.localTemplate, t.tag));
  }
}
