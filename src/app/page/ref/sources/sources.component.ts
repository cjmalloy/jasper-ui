import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { getArgs } from '../../../util/query';
import { MobxAngularModule } from 'mobx-angular';

@Component({
    selector: 'app-ref-sources',
    templateUrl: './sources.component.html',
    styleUrls: ['./sources.component.scss'],
    imports: [MobxAngularModule, RefListComponent],
})
export class RefSourcesComponent implements OnInit, OnDestroy, HasChanges {

  private disposers: IReactionDisposer[] = [];

  @ViewChild(RefListComponent)
  list?: RefListComponent;

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

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      this.page = Page.of(this.sources.map(url => ({ url })) || []);
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
      for (let i = 0; i < this.sources.length; i ++) {
        if (this.page.content[i].created) continue;
        const url = this.sources[i];
        const existing = this.query.page.content.find(r => r.url === url);
        if (existing) this.page.content[i] = existing;
      }
    }));
    // TODO: set title for bare reposts
    this.disposers.push(autorun(() => this.mod.setTitle($localize`Sources: ` + getTitle(this.store.view.ref))));
  }

  ngOnDestroy() {
    this.query.close();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get sources() {
    return uniq(this.store.view.ref?.sources).filter(s => s != this.store.view.url);
  }

}
