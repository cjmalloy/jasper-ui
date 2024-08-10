import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
})
export class RefSourcesComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  page: Page<Ref> = Page.of([]);

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = ['published']);
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.page = Page.of(this.store.view.ref?.sources?.map(url => ({ url })) || []);
    }));
    this.disposers.push(autorun(() => {
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
    }));
    this.disposers.push(autorun(() => {
      if (!this.query.page) return;
      for (let i = 0; i < (this.store.view.ref?.sources?.length || 0); i ++) {
        if (this.page.content[i].created) continue;
        const url = this.store.view.ref!.sources![i];
        const existing = this.query.page.content.find(r => r.url === url);
        if (existing) this.page.content[i] = existing;
      }
    }));
    this.disposers.push(autorun(() => {
      this.mod.setTitle($localize`Sources: ` + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
