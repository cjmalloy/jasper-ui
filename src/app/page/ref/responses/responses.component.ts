import { Component, effect, inject, viewChild } from '@angular/core';
import { uniq } from 'lodash-es';
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
export class RefResponsesComponent implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const store = this.store;
    store.view.defaultSort.set(['published']);
    this.query.watch(() => {
      const hideInternal = !this.admin.getPlugins(this.store.view.queryTags()).length;
      return {
        ...getArgs(
          '',
          this.store.view.sort(),
          uniq([...hideInternal ? ['query/!internal', 'query/!plugin/delete', 'user/!plugin/user/hide'] : ['query/!plugin/delete', 'user/!plugin/user/hide'], ...this.store.view.filter() || []]) as UrlFilter[],
          this.store.view.search(),
          this.store.view.pageNumber(),
          this.store.view.pageSize(),
            ),
        responses: this.store.view.url(),
        };
    });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Responses: ` + getTitle(this.store.view.ref())));
    effect(() => {
      const ref = this.store.view.ref();
      if (ref) {
        const responsesCount = ref.metadata?.responses || 0;
        this.store.local.setLastSeenCount(this.store.view.url(), 'replies', responsesCount);
      }
    });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

}
