import { Component, computed, inject, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ExtListComponent } from '../../component/ext/ext-list/ext-list.component';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { AuthzService } from '../../service/authz.service';
import { ModService } from '../../service/mod.service';
import { ExtStore } from '../../store/ext';
import { Store } from '../../store/store';
import { getTagFilter, getTagQueryFilter } from '../../util/query';
import { andQueries, braces, getPrefixes, hasPrefix, publicTag } from '../../util/tag';

@Component({
  selector: 'app-tags-page',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss'],
  imports: [
    ExtListComponent,
    TabsComponent,
    RouterLink,
    SidebarComponent,
  ]
})
export class TagsPage implements HasChanges {
  private mod = inject(ModService);
  admin = inject(AdminService);
  store = inject(Store);
  query = inject(ExtStore);
  private auth = inject(AuthzService);
  private exts = inject(ExtService);


  private readonly templateExt = rxResource({
    params: () => this.store.view.template(),
    stream: ({ params }) => this.exts.getCachedExt(params),
  });
  readonly title = computed(() => (this.templateExt.hasValue() ? this.templateExt.value().name : '')
    || this.store.view.template() && this.admin.getTemplate(this.store.view.template())?.name
    || this.store.view.ext()?.name
    || this.store.view.template()
    || '');
  templates = this.admin.tmplSubmit().filter(t => t.config?.view);

  readonly list = viewChild<ExtListComponent>('list');

  constructor() {
    const mod = this.mod;
    const store = this.store;

    mod.setTitle($localize`Tags`);
    store.view.clear(['tag:len', 'tag'], ['tag:len', 'tag']);
    this.query.watch(() => {
      const query
        = this.store.view.home()
        ? [...getPrefixes('config/home'), ...this.store.account.subs(), ...this.store.account.bookmarkQueries()].filter(t => this.auth.tagReadAccess(t)).join('|')
        : this.store.view.noTemplate()
          ? [braces(this.store.view.template()), '!+user', '!_user', ...this.templates.map(t => '!' + t.tag).flatMap(getPrefixes)].filter(t => this.auth.tagReadAccess(t)).join(':')
          : this.store.view.template()
            ? (publicTag(this.store.view.template())
              ? getPrefixes(this.store.view.template()).filter(t => this.auth.tagReadAccess(t)).join('|')
              : this.store.view.template())
            : '@*';
      return {
        query: andQueries([getTagQueryFilter(braces(query), this.store.view.filter()), !this.store.view.showRemotes() ? this.store.account.origin() || '*' : '']),
        search: this.store.view.search(),
        sort: [...this.store.view.sort()],
        page: this.store.view.pageNumber(),
        size: this.store.view.pageSize(),
        ...getTagFilter(this.store.view.filter()),
      };
    });
  }

  saveChanges() {
    const list = this.list();
    return !list || list.saveChanges();
  }

  templateIs(tag: string): boolean {
    return hasPrefix(this.store.view.localTemplate(), tag);
  }

  readonly templateExists = computed<boolean>(() => {
    if (this.store.view.localTemplate() === 'user') return true;
    return !!this.templates.find(t => hasPrefix(this.store.view.localTemplate(), t.tag));
  });
}
