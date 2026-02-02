import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  viewChild
} from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ref-responses',
  templateUrl: './responses.component.html',
  styleUrls: ['./responses.component.scss'],
  imports: [
    RefListComponent,
  ],
})
export class RefResponsesComponent implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  constructor() {
    const store = this.store;
    const query = this.query;

    query.clear();
    store.view.defaultSort = ['published'];
  }

  ngOnInit(): void {
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
    }, { injector: this.injector });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Responses: ` + getTitle(this.store.view.ref)), { injector: this.injector });
    effect(() => {
      if (this.store.view.ref) {
        const responsesCount = this.store.view.ref.metadata?.responses || 0;
        this.store.local.setLastSeenCount(this.store.view.url, 'replies', responsesCount);
      }
    }, { injector: this.injector });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
