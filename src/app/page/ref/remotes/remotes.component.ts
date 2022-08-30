import { Component, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { filterListToObj, getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-remotes',
  templateUrl: './remotes.component.html',
  styleUrls: ['./remotes.component.scss']
})
export class RefRemotesComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const args = getArgs(
        '',
        this.store.view.sort,
        {...filterListToObj(this.store.view.filter), url: this.store.view.url},
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize ?? this.defaultPageSize
      );
      _.defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      this.theme.setTitle('Remotes: ' + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
