import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { ThemeService } from '../../service/theme.service';
import { ExtStore } from '../../store/ext';
import { Store } from '../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../util/query';
import { braces, getPrefixes, hasPrefix, publicTag } from '../../util/tag';

@Component({
  selector: 'app-tags-page',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  title = '';
  defaultTitle = $localize`Tags`;
  templates = this.admin.tmplSubmit.filter(t => t.config?.view);

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public store: Store,
    public query: ExtStore,
    private auth: AuthzService,
  ) {
    theme.setTitle($localize`Tags`);
    store.view.clear('modified,DESC', 'name,ASC');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.title = this.store.view.template && this.admin.getTemplate(this.store.view.template)?.name || this.store.view.template || this.defaultTitle;
      const query
        = this.store.view.home
        ? [...getPrefixes('home'), ...this.store.account.subs, ...this.store.account.bookmarks].filter(t => this.auth.tagReadAccess(t)).join('|')
        : this.store.view.template
        ? (publicTag(this.store.view.template)
            ? getPrefixes(this.store.view.template).filter(t => this.auth.tagReadAccess(t)).join('|')
            : this.store.view.template)
        : this.store.view.noTemplate
        ? ['!+user', '!_user', ...this.templates.map(t => '!' + t.tag).flatMap(getPrefixes)].filter(t => this.auth.tagReadAccess(t)).join(':')
        : '@*';
      const args = {
        query: braces(query) + getTagQueryFilter(this.store.view.filter) + ':' + (this.store.view.showRemotes ? '@*' : (this.store.account.origin || '*')),
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
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  templateIs(tag: string): boolean {
    return hasPrefix(this.store.view.localTemplate, tag);
  }

  get templateExists(): boolean {
    return !!this.templates.find(t => hasPrefix(this.store.view.localTemplate, t.tag));
  }
}
