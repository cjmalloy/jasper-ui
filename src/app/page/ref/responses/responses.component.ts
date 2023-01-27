import { Component, OnDestroy, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-responses',
  templateUrl: './responses.component.html',
  styleUrls: ['./responses.component.scss'],
})
export class RefResponsesComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

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
        _.uniq(['notInternal', ...this.store.view.filter]),
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.responses = this.store.view.url;
      _.defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      this.theme.setTitle('Responses: ' + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
