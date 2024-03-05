import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-versions',
  templateUrl: './versions.component.html',
  styleUrls: ['./versions.component.scss']
})
export class RefVersionsComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = 'published');
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        '',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.url = this.store.view.url;
      args.obsolete = true;
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      this.mod.setTitle($localize`Remotes: ` + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
