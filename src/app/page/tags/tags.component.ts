import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../service/admin.service';
import { ThemeService } from '../../service/theme.service';
import { ExtStore } from '../../store/ext';
import { Store } from '../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../util/query';

@Component({
  selector: 'app-tags-page',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss']
})
export class TagsPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  title = '';
  templates = this.admin.tmplView;

  constructor(
    private theme: ThemeService,
    private admin: AdminService,
    public store: Store,
    public query: ExtStore,
  ) {
    theme.setTitle($localize`Tags`);
    store.view.clear('tag', 'tag');
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.title = this.store.view.template && this.admin.getTemplate(this.store.view.template)?.name || '';
      const query = this.store.view.template || ('(' + this.templates.map(t => t.tag).join('|') + ')');
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
