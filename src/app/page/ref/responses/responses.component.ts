import { 
  ChangeDetectionStrategy,
  Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
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
  standalone: false,
  selector: 'app-ref-responses',
  templateUrl: './responses.component.html',
  styleUrls: ['./responses.component.scss'],
})
export class RefResponsesComponent implements OnInit, OnDestroy, HasChanges {

  private disposers: IReactionDisposer[] = [];

  @ViewChild(RefListComponent)
  list?: RefListComponent;

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = ['published']);
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
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
    }));
    // TODO: set title for bare reposts
    this.disposers.push(autorun(() => this.mod.setTitle($localize`Responses: ` + getTitle(this.store.view.ref))));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
