import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getArgs } from '../../../util/query';

@Component({
  standalone: false,
  selector: 'app-ref-versions',
  templateUrl: './versions.component.html',
  styleUrls: ['./versions.component.scss']
})
export class RefVersionsComponent implements OnInit, OnDestroy, HasChanges {

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
    return !!this.list?.saveChanges();
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
