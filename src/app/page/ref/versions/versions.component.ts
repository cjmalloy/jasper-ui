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
import { defer } from 'lodash-es';

import { RefListComponent } from '../../../component/ref/ref-list/ref-list.component';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { AdminService } from '../../../service/admin.service';
import { ModService } from '../../../service/mod.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';
import { getTitle } from '../../../util/format';
import { getArgs } from '../../../util/query';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ref-versions',
  templateUrl: './versions.component.html',
  styleUrls: ['./versions.component.scss'],
  imports: [ RefListComponent]
})
export class RefVersionsComponent implements OnInit, OnDestroy, HasChanges {
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
      const args = getArgs(
        '',
        this.store.view.sort,
        this.store.view.filter,
        this.store.view.search,
        this.store.view.pageNumber,
        this.store.view.pageSize,
      );
      args.url = this.store.view.url;
      args.obsolete = this.store.view.ref?.metadata?.obsolete ? null : true;
      defer(() => this.query.setArgs(args));
    }, { injector: this.injector });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Remotes: ` + getTitle(this.store.view.ref)), { injector: this.injector });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
