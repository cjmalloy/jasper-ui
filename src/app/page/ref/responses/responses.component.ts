import { Component, effect, OnDestroy, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { getArgs, UrlFilter } from '../../../util/query';

@Component({
  selector: 'app-ref-responses',
  templateUrl: './responses.component.html',
  styleUrls: ['./responses.component.scss'],
  imports: [

    RefListComponent,
  ],
})
export class RefResponsesComponent implements OnDestroy, HasChanges {

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    store.view.defaultSort = ['published'];

    // Effect for query args
    effect(() => {
      const hideInternal = !this.admin.getPlugins(this.store.view.queryTags).length;
      const args = getArgs(
        '',
        this.store.view.sort,
        uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete', 'user/!plugin/user/hide'] : ['query/!plugin/delete', 'user/!plugin/user/hide'], ...this.store.view.filter || []]) as UrlFilter[],
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.responses = this.store.view.url;
      defer(() => this.query.setArgs(args));
    });

    // Effect for title
    effect(() => this.mod.setTitle($localize`Responses: ` + getTitle(this.store.view.ref)));

    // Effect for last seen count
    effect(() => {
      if (this.store.view.ref) {
        const responsesCount = this.store.view.ref.metadata?.responses || 0;
        this.store.local.setLastSeenCount(this.store.view.url, 'replies', responsesCount);
      }
    });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
