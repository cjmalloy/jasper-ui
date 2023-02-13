import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { AdminService } from '../../../service/admin.service';
import { ThemeService } from '../../../service/theme.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-ref-alts',
  templateUrl: './alts.component.html',
  styleUrls: ['./alts.component.scss']
})
export class RefAltsComponent implements OnInit, OnDestroy {

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
      runInAction(() => this.query.page = {
        content: [],
        empty: true,
        first: true,
        last: true,
        number: 0,
        size: 0,
        totalElements: 0,
        totalPages: 1,
      });
      this.theme.setTitle($localize`Alts: ` + (this.store.view.ref?.title || this.store.view.url))
      if (!this.store.view.ref?.alternateUrls) return;
      runInAction(() => {
        for (const url of this.store.view.ref!.alternateUrls!) {
            this.query.page!.empty = false;
            this.query.page!.content.push({ url });
            this.query.page!.totalElements++;
            this.query.page!.size++;
        }
      });
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

}
