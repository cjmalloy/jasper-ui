import { Component, ChangeDetectionStrategy, viewChild, effect, signal, DestroyRef, inject } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RefListComponent]
})
export class RefAltsComponent implements HasChanges {

  readonly list = viewChild<RefListComponent>('list');

  readonly page = signal<Page<Ref>>(Page.of([]));

  constructor(
    private mod: ModService,
    public admin: AdminService,
    public store: Store,
    public query: QueryStore,
  ) {
    query.clear();
    store.view.defaultSort.set(['modified']);
    effect(() => {
      this.page.set(Page.of(this.store.view.ref()?.alternateUrls?.map(url => ({ url })) || []));
    });
    effect(() => {
      const args = getArgs(
        '',
        this.store.view.sort(),
        this.store.view.filter(),
        this.store.view.search(),
        this.store.view.pageNumber(),
        this.store.view.pageSize(),
      );
      args.url = this.store.view.url();
      defer(() => this.query.setArgs(args));
    });
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

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.query.close();
  });

}
