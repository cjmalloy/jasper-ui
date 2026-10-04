import { Component, viewChild, effect, signal, inject } from '@angular/core';
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
  imports: [RefListComponent]
})
export class RefAltsComponent implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  readonly page = signal<Page<Ref>>(Page.of([]));

  constructor() {
    const store = this.store;
    store.view.defaultSort.set(['modified']);
    effect(() => {
      this.page.set(Page.of(this.store.view.ref()?.alternateUrls?.map(url => ({ url })) || []));
    });
    this.query.watch(() => ({
      ...getArgs(
        '',
        this.store.view.sort(),
        this.store.view.filter(),
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      ),
      url: this.store.view.url(),
    }));
    effect(() => {
      const page = this.query.page();
      if (!page) return;
      const refs = [...page.content];
      for (let i = 0; i < (this.store.view.ref()?.alternateUrls?.length || 0); i ++) {
        const url = this.store.view.ref()!.alternateUrls![i];
        if (refs.find(r => r.url === url)) continue;
        refs.push({ url });
      }
      this.page.set({
        ...page,
        content: refs,
      });
    });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Alternate URLs: ` + getTitle(this.store.view.ref())));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

}
