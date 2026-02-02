import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { defer, uniq } from 'lodash-es';

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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ref-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
  imports: [
    RefListComponent,
  ],
})
export class RefSourcesComponent implements OnInit, OnDestroy, HasChanges {
  private injector = inject(Injector);
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  @ViewChild('list')
  list?: RefListComponent;

  page: Page<Ref> = Page.of([]);

  constructor() {
    const store = this.store;
    const query = this.query;

    query.clear();
    store.view.defaultSort = ['published'];
  }

  ngOnInit(): void {
    effect(() => {
      this.page = Page.of(this.sources.map(url => ({ url })) || []);
    }, { injector: this.injector });
    effect(() => {
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
    }, { injector: this.injector });
    effect(() => {
      if (!this.query.page) return;
      for (let i = 0; i < this.sources.length; i ++) {
        if (this.page.content[i].created) continue;
        const url = this.sources[i];
        const existing = this.query.page.content.find(r => r.url === url);
        if (existing) this.page.content[i] = existing;
      }
    }, { injector: this.injector });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Sources: ` + getTitle(this.store.view.ref)), { injector: this.injector });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }

  get sources() {
    return uniq(this.store.view.ref?.sources).filter(s => s != this.store.view.url);
  }
}
