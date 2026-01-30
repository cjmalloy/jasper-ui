import { Component, effect, OnDestroy, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
  imports: [

    RefListComponent,
  ],
})
export class RefSourcesComponent implements OnDestroy, HasChanges {

  @ViewChild('list')
  list?: RefListComponent;

  page: Page<Ref> = Page.of([]);

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    store.view.defaultSort = ['published'];

    // Effect for page from sources
    effect(() => {
      this.page = Page.of(this.sources.map(url => ({ url })) || []);
    });

    // Effect for query args
    effect(() => {
      const args = getArgs(
        '',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.sources = this.store.view.url;
      defer(() => this.query.setArgs(args));
    });

    // Effect for merging query results
    effect(() => {
      if (!this.query.page) return;
      for (let i = 0; i < this.sources.length; i ++) {
        if (this.page.content[i].created) continue;
        const url = this.sources[i];
        const existing = this.query.page.content.find(r => r.url === url);
        if (existing) this.page.content[i] = existing;
      }
    });

    // Effect for title
    effect(() => this.mod.setTitle($localize`Sources: ` + getTitle(this.store.view.ref)));
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }

  get sources() {
    return uniq(this.store.view.ref?.sources).filter(s => s != this.store.view.url);
  }
}
