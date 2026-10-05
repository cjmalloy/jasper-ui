import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { uniq } from 'lodash-es';
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
  selector: 'app-ref-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
  imports: [
    RefListComponent,
  ],
})
export class RefSourcesComponent implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(QueryStore);


  readonly list = viewChild<RefListComponent>('list');

  readonly page = signal<Page<Ref>>(Page.of([]));

  constructor() {
    const store = this.store;
    store.view.defaultSort.set(['published']);
    effect(() => {
      this.page.set(Page.of(this.sources().map(url => ({ url })) || []));
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
      sources: this.store.view.url(),
    }));
    effect(() => {
      if (!this.query.page()) return;
      this.page.update(page => ({
        ...page,
        content: page.content.map((ref, i) => {
          if (ref.created) return ref;
          const url = this.sources()[i];
          return this.query.page()!.content.find(r => r.url === url) || ref;
        }),
      }));
    });
    // TODO: set title for bare reposts
    effect(() => this.mod.setTitle($localize`Sources: ` + getTitle(this.store.view.ref())));
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  readonly sources = computed(() => {
    return uniq(this.store.view.ref()?.sources).filter(s => s != this.store.view.url());
  });

}
