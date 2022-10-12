import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Ref, RefSort } from '../model/ref';
import { TagSort } from '../model/tag';
import { hasPrefix, isQuery, localTag } from '../util/tag';

export class ViewStore {

  defaultPageSize = 20;
  defaultBlogPageSize = 5;
  defaultSort: RefSort | TagSort = 'published';
  defaultSearchSort: RefSort | TagSort = 'rank';
  ref?: Ref = {} as any;
  remoteCount = 0;
  ext?: Ext = {} as any;
  pinned?: Ref[] = [];

  constructor(
    public route: RouterStore,
  ) {
    makeAutoObservable(this);
    this.clear(); // Initial observables may not be null for MobX
  }

  clear(defaultSort: RefSort | TagSort = 'published', defaultSearchSort: RefSort | TagSort = 'rank') {
    this.ref = undefined;
    this.remoteCount = 0;
    this.ext = undefined;
    this.pinned = undefined;
    this.defaultSort = defaultSort;
    this.defaultSearchSort = defaultSearchSort;
  }

  get url() {
    return this.route.routeSnapshot?.firstChild?.params['url'];
  }

  get origin() {
    return this.route.routeSnapshot?.queryParams['origin'];
  }

  get depth() {
    return this.route.routeSnapshot?.queryParams['depth'];
  }

  get isTextPost() {
    return this.url?.startsWith('comment:');
  }

  get isWikiPost() {
    return this.url?.startsWith('wiki:');
  }

  get tag() {
    return this.route.routeSnapshot?.firstChild?.params['tag'];
  }

  get localTag() {
    return localTag(this.tag);
  }

  get name() {
    const title = this.ext?.name || this.ext?.tag || this.tag;
    if (title === '@*') return 'All';
    if (title === '*') return 'Local';
    return title;
  }

  get sort() {
    const sort = this.route.routeSnapshot?.queryParams['sort'];
    if (!sort) return [this.search ? this.defaultSearchSort : this.defaultSort];
    if (!Array.isArray(sort)) return [sort]
    return sort;
  }

  get filter(): string[] {
    const filter = this.route.routeSnapshot?.queryParams['filter'];
    if (!filter) return [];
    if (!Array.isArray(filter)) return [filter]
    return filter;
  }

  get search() {
    return this.route.routeSnapshot?.queryParams['search'];
  }

  get pageNumber() {
    return this.route.routeSnapshot?.queryParams['pageNumber'];
  }

  get pageSize() {
    return parseInt(this.route.routeSnapshot?.queryParams['pageSize'] ?? (this.blog ? this.defaultBlogPageSize : this.defaultPageSize));
  }

  get hideSearch() {
    return this.route.routeSnapshot?.queryParams['hideSearch'];
  }

  get noView() {
    return !this.route.routeSnapshot?.queryParams['view'];
  }

  get list() {
    return this.route.routeSnapshot?.queryParams['view'] === 'list';
  }

  get graph() {
    return this.route.routeSnapshot?.queryParams['view'] === 'graph';
  }

  get user() {
    return !isQuery(this.tag) && hasPrefix(this.tag, 'user');
  }

  get kanban() {
    return !isQuery(this.tag) && hasPrefix(this.tag, 'kanban');
  }

  get chat() {
    return !isQuery(this.tag) && hasPrefix(this.tag, 'chat');
  }

  get blog() {
    return !isQuery(this.tag) && hasPrefix(this.tag, 'blog');
  }

  get queue() {
    return !isQuery(this.tag) && hasPrefix(this.tag, 'queue');
  }
}
