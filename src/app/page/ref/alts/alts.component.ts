import { Component, OnDestroy, OnInit } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  selector: 'app-ref-alts',
  templateUrl: './alts.component.html',
  styleUrls: ['./alts.component.scss']
})
export class RefAltsComponent implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];

  page: Page<Ref> = Page.of([]);

  constructor(
    private theme: ThemeService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    runInAction(() => store.view.defaultSort = 'modified');
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.page = Page.of(this.store.view.ref?.alternateUrls?.map(url => ({ url })) || []);
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
      args.url = this.store.view.url;
      defer(() => this.query.setArgs(args));
    }));
    this.disposers.push(autorun(() => {
      if (!this.query.page) return;
      const refs = this.query.page.content;
      for (let i = 0; i < (this.store.view.ref?.alternateUrls?.length || 0); i ++) {
        const url = this.store.view.ref!.alternateUrls![i];
        if (refs.find(r => r.url === url)) continue;
        refs.push({ url });
      }
      this.page = {
        ...this.query.page,
        content: refs,
      };
    }));
    this.disposers.push(autorun(() => {
      this.theme.setTitle($localize`Alternate URLs: ` + (this.store.view.ref?.title || this.store.view.url));
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
