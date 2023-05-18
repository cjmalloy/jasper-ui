import { without } from 'lodash-es';
import { autorun, makeAutoObservable, runInAction } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Ref, RefSort } from '../model/ref';
import { TagSort } from '../model/tag';
import { User } from '../model/user';
import { UrlFilter } from '../util/query';
import { hasPrefix, isQuery, localTag } from '../util/tag';
import { EventBus } from './bus';

/**
 * ID for current view. Only includes pages that make queries.
 * For example, the alt refs and missing refs pages are not included since
 * they do not make queries.
 */
export type View =
  'home' | 'all' | 'local' |
  'tag' | 'tags' | 'query' |
  'inbox/all' | 'inbox/sent' | 'inbox/alarms' | 'inbox/dms' | 'inbox/modlist' |
  'ref/summary' | 'ref/comments' | 'ref/thread' | 'ref/responses' | 'ref/sources' | 'ref/versions' |
  'ext' | 'user' | 'plugin' | 'template';

export type Type = 'ref' | 'ext' | 'user' | 'plugin' | 'template';

export class ViewStore {

  defaultPageSize = 20;
  defaultBlogPageSize = 5;
  defaultSort: RefSort | TagSort = 'published';
  defaultSearchSort: RefSort | TagSort = 'rank';
  ref?: Ref = {} as any;
  versions = 0;
  ext?: Ext = {} as any;
  selectedUser?: User = {} as any;
  pinned?: Ref[] = [];
  updates = false;

  constructor(
    public route: RouterStore,
    private eventBus: EventBus,
  ) {
    makeAutoObservable(this);
    this.clear(); // Initial observables may not be null for MobX

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.ref?.url && this.eventBus.isRef(this.ref)) {
          runInAction(() => this.ref = this.eventBus.ref);
        }
      }
    });
  }

  clear(defaultSort: RefSort | TagSort = 'published', defaultSearchSort: RefSort | TagSort = 'rank') {
    this.ref = undefined;
    this.versions = 0;
    this.ext = undefined;
    this.selectedUser = undefined;
    this.pinned = undefined;
    this.defaultSort = defaultSort;
    this.defaultSearchSort = defaultSearchSort;
  }

  get url() {
    return this.route.routeSnapshot?.firstChild?.params['url'];
  }

  get summary() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.routeConfig?.path !== 'ref/:url') return false;
    return !s.firstChild?.routeConfig?.path;
  }

  get tags() {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'tags';
  }

  get settings() {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'settings';
  }

  get current(): View | undefined {
    const s = this.route.routeSnapshot?.firstChild;
    switch (s?.routeConfig?.path) {
      case 'home': return 'home';
      case 'tags': return 'tags';
      case 'tags/:template': return 'tags';
      case 'tag/:tag':
        if (this.tag === '') return 'tags';
        if (this.tag === '@*') return 'all';
        if (this.tag === '*') return 'local';
        if (isQuery(this.tag)) return 'query';
        return 'tag';
      case 'ref/:url':
        switch (s.firstChild?.routeConfig?.path) {
          case '': return 'ref/summary';
          case 'comments': return 'ref/comments';
          case 'thread': return 'ref/thread';
          case 'responses': return 'ref/responses';
          case 'sources': return 'ref/sources';
          case 'versions': return 'ref/versions';
        }
        return undefined;
      case 'settings':
        switch (s.firstChild?.routeConfig?.path) {
          case 'ext': return 'ext';
          case 'user': return 'user';
          case 'plugin': return 'plugin';
          case 'template': return 'template';
          case 'ref/:tag': return 'tag';
        }
        return undefined;
      case 'inbox':
        switch (s.firstChild?.routeConfig?.path) {
          case 'all': return 'inbox/all';
          case 'sent': return 'inbox/sent';
          case 'alarms': return 'inbox/alarms';
          case 'dms': return 'inbox/dms';
          case 'modlist': return 'inbox/modlist';
        }
        return undefined;
    }
    return undefined;
  }

  get type(): Type | undefined {
    if (!this.current) return undefined;
    if (this.current === 'ref/summary') return undefined;
    if (this.current === 'tags') return 'ext';
    if (this.current.startsWith('ref/') ||
      this.current.startsWith('inbox/') ||
      this.current ==='home' ||
      this.current ==='all' ||
      this.current ==='local' ||
      this.current ==='tag' ||
      this.current ==='query' ) {
      return 'ref';
    }
    return this.current as Type;
  }

  get forYou() {
    return !!this.route.routeSnapshot?.queryParams['forYou'];
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

  get tag(): string {
    return this.route.routeSnapshot?.firstChild?.params['tag'] || '';
  }

  get template(): string {
    return this.route.routeSnapshot?.firstChild?.params['template'] || '';
  }

  get noTemplate(): boolean {
    return this.route.routeSnapshot?.queryParams['noTemplate'] === 'true';
  }

  get query() {
    return isQuery(this.tag) ? this.tag : '';
  }

  get noQuery() {
    return isQuery(this.tag) ? '' : this.tag;
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

  get isSorted() {
    if (this.sort.length > 1) return true;
    return this.sort[0] !== (this.search ? this.defaultSearchSort : this.defaultSort);
  }

  get isVoteSorted() {
    return this.sort[0].startsWith('vote');
  }

  get filter(): UrlFilter[] {
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
    return parseInt(this.route.routeSnapshot?.queryParams['pageSize'] ?? (this.isTemplate('blog') ? this.defaultBlogPageSize : this.defaultPageSize));
  }

  get published() {
    return this.route.routeSnapshot?.queryParams['published'];
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

  get showRemotes() {
    return this.route.routeSnapshot?.queryParams['showRemotes'] === 'true';
  }

  isTemplate(tag: string) {
    return !isQuery(this.tag) && hasPrefix(this.tag, tag);
  }

  toggleTag(tag: string) {
    let query = this.tag;
    if (!query || query === '@*') return tag;
    if (query === tag) return '@*';
    if (query.includes(':' + tag)) return query.replace(':' + tag, '');
    if (query.includes(tag + ':')) return query.replace(tag + ':', '');
    if (query.includes('|')) query = '(' + query + ')';
    return query + ':' + tag;
  }

  toggleFilter(filter: UrlFilter) {
    const filters = this.filter;
    if (filters.includes(filter)) return without(filters, filter);
    return [...filters, filter];
  }

  updateNotify() {
    return this.updates = true;
  }
}
