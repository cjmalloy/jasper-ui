import { Component, effect, OnDestroy, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';

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
  selector: 'app-ref-alts',
  templateUrl: './alts.component.html',
  styleUrls: ['./alts.component.scss'],
  imports: [ RefListComponent]
})
export class RefAltsComponent implements OnDestroy, HasChanges {

  @ViewChild('list')
  list?: RefListComponent;

  page: Page<Ref> = Page.of([]);

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    store.view.defaultSort = ['modified'];

    // Effect for page from alternateUrls
    effect(() => {
      this.page = Page.of(this.store.view.ref?.alternateUrls?.map(url => ({ url })) || []);
    });

    // Effect for query args
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
      defer(() => this.query.setArgs(args));
    });

    // Effect for merging query page with alternateUrls
    effect(() => {
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
    });

    // Effect for title
    effect(() => this.mod.setTitle($localize`Alternate URLs: ` + getTitle(this.store.view.ref)));
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.query.close();
  }
}
