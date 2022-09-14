import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Ref } from '../model/ref';
import { hasPrefix, isQuery, localTag } from '../util/tag';

export class ViewStore {

  defaultPageSize = 20;
  defaultBlogPageSize = 5;
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

  clear() {
    this.ref = undefined;
    this.remoteCount = 0;
    this.ext = undefined;
    this.pinned = undefined;
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
    return this.route.routeSnapshot?.firstChild?.params['sort'];
  }

  get filter() {
    return this.route.routeSnapshot?.queryParams['filter'];
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

  get list() {
    return this.route.routeSnapshot?.queryParams['list'] === 'true';
  }

  get graph() {
    return this.route.routeSnapshot?.queryParams['graph'] === 'true';
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
