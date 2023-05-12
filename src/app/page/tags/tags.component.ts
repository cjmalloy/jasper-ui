import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../service/admin.service';
import { ThemeService } from '../../service/theme.service';
import { ExtStore } from '../../store/ext';
import { Store } from '../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../util/query';
import { getPrefixes } from '../../util/tag';

@Component({
  selector: 'app-tags-page',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  title = '';
  defaultTitle = $localize`Tags`;
  templates = this.admin.tmplView;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public store: Store,
    public query: ExtStore,
  ) {
    theme.setTitle($localize`Tags`);
    store.view.clear('levels', 'levels');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.title = this.store.view.template && this.admin.getTemplate(this.store.view.template)?.name || this.defaultTitle;
      const query =
        this.store.view.noTemplate
          ? ['!+user:!_user', ...this.templates.map(t => '!' + t.tag).flatMap(getPrefixes)].join(':')
          : this.store.view.template
            ? getPrefixes(this.store.view.template).join('|')
            : '!+user:!_user';
      const args = {
        query: query + getTagQueryFilter(this.store.view.filter),
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
}
