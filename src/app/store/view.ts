import { uniq, without } from 'lodash-es';
import { action, autorun, computed, makeObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Ref, RefSort } from '../model/ref';
import { TagSort } from '../model/tag';
import { Template } from '../model/template';
import { User } from '../model/user';
import { RootConfig } from '../mods/root';
import { UrlFilter } from '../util/query';
import { hasPrefix, isQuery, localTag, queryPrefix, topAnds } from '../util/tag';
import { AccountStore } from "./account";
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

  @observable
  defaultPageSize = 24;
  @observable
  defaultKanbanLoadSize = 8;
  @observable
  defaultBlogPageSize = 5;
  @observable
  defaultSort: RefSort | TagSort = 'published';
  @observable
  defaultSearchSort: RefSort | TagSort = 'rank';
  @observable
  ref?: Ref = {} as any;
  @observable
  lastSelected?: Ref = {} as any;
  @observable
  versions = 0;
  @observable.shallow
  exts: Ext[] = [];
  @observable.shallow
  extTemplates: Template[] = [];
  @observable
  selectedUser?: User = {} as any;
  @observable
  updates = false;

  constructor(
    public route: RouterStore,
    private account: AccountStore,
    private eventBus: EventBus,
  ) {
    makeObservable(this);
    this.clear(); // Initial observables may not be null for MobX

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.ref?.url && this.eventBus.isRef(this.ref)) {
          this.setRef(this.eventBus.ref);
        }
      }
    });
  }

  @action
  setRef(ref?: Ref) {
    if (this.ref && !ref) {
      this.lastSelected = this.ref;
    }
    this.ref = ref;
    if (this.ref) {
      this.lastSelected = this.ref;
    }
  }

  @action
  clearLastSelected() {
    this.lastSelected = undefined;
  }

  @action
  clear(defaultSort: RefSort | TagSort = 'published', defaultSearchSort: RefSort | TagSort = 'rank') {
    this.ref = undefined;
    this.versions = 0;
    this.exts = [];
    this.extTemplates = [];
    this.selectedUser = undefined;
    this.defaultSort = defaultSort;
    this.defaultSearchSort = defaultSearchSort;
  }

  @computed
  get ext() {
    return this.exts[0];
  }

  @computed
  get extTemplate() {
    return this.exts.length === 1 && this.extTemplates.find(t => this.exts.find(x => hasPrefix(x.tag, t.tag)));
  }

  @computed
  get config(): RootConfig | undefined {
    return this.viewExt?.config;
  }

  @computed
  get url() {
    return this.route.routeSnapshot?.firstChild?.params['url'];
  }

  @computed
  get summary() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return !s.firstChild?.routeConfig?.path;
  }

  @computed
  get alternateUrls() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return s.firstChild?.routeConfig?.path === 'alts';
  }

  @computed
  get activeExts(): Ext[] {
    return uniq(this.activeTemplates
        .flatMap(t => {
          const exts = this.exts.filter(x => x.modifiedString && hasPrefix(x.tag, t.tag));
          if (exts.length) return exts;
          return [{ tag: t.tag, origin: t.origin, name: t.config?.view || t.name, config: t.defaults }];
        })
        .filter(x => !!x));
  }

  @computed
  get globalExts(): Ext[] {
    return uniq(this.globalTemplates
        .flatMap(t => {
          if (this.exts.find(x => x.modifiedString && hasPrefix(x.tag, t.tag))) {
            // Already an active ext so ignore global
            return [];
          }
          return [{ tag: t.tag, origin: t.origin, name: t.config?.view || t.name, config: t.defaults }];
        })
        .filter(x => !!x));
  }

  @computed
  get activeTemplates(): Template[] {
    return uniq(this.queryTags
        .map(tag => this.extTemplates.find(t => hasPrefix(tag, t.tag))!)
        .filter(t => !!t));
  }

  @computed
  get globalTemplates(): Template[] {
    return this.extTemplates.filter(t => t.config?.global);
  }

  @computed
  get hasTemplate() {
    return !!this.activeTemplates.length || !!this.globalTemplates.length;
  }

  isTemplate(template: string) {
    return hasPrefix(this.viewExt?.tag, template);
  }

  @computed
  get tags(): boolean {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.url[0].path === 'tags';
  }

  @computed
  get allTags(): boolean {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.url[0].path === 'tags' && !s?.params.template;
  }

  @computed
  get settings() {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'settings';
  }

  @computed
  get current(): View | undefined {
    const s = this.route.routeSnapshot?.firstChild;
    switch (s?.url[0].path) {
      case 'home': return 'home';
      case 'tags': return 'tags';
      case 'tag':
        if (this.tag === '') return 'tags';
        if (this.tag === '@*') return 'all';
        if (this.tag === '*') return 'local';
        if (isQuery(this.tag)) return 'query';
        return 'tag';
      case 'ref':
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

  @computed
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

  @computed
  get forYou() {
    return !!this.route.routeSnapshot?.queryParams['forYou'];
  }

  @computed
  get origin() {
    return this.route.routeSnapshot?.queryParams['origin'];
  }

  @computed
  get depth() {
    return this.route.routeSnapshot?.queryParams['depth'];
  }

  @computed
  get isTextPost() {
    return this.url?.startsWith('comment:');
  }

  @computed
  get alarm(): boolean {
    return this.account.alarms.includes(this.tag);
  }

  @computed
  get tag(): string {
    return this.route.routeSnapshot?.firstChild?.params['tag'] || '';
  }

  @computed
  get viewTag(): string {
    return this.view || this.activeExts[0]?.tag || '';
  }

  @computed
  get viewExt() {
    if (this.list) return undefined;
    return [...this.activeExts, ...this.globalExts].find(x => x.tag === this.viewTag) || this.exts[0];
  }

  @computed
  get template(): string {
    return this.route.routeSnapshot?.firstChild?.params['template'] || '';
  }

  @computed
  get localTemplate(): string {
    return localTag(this.template);
  }

  @computed
  get userTemplate() {
    return hasPrefix(this.localTemplate, 'user');
  }

  @computed
  get noTemplate(): boolean {
    return this.route.routeSnapshot?.queryParams['noTemplate'] === 'true';
  }

  @computed
  get home(): boolean {
    return this.route.routeSnapshot?.queryParams['home'] === 'true';
  }

  @computed
  get query() {
    return isQuery(this.tag) ? this.tag : '';
  }

  @computed
  get queryTags() {
    return uniq([
        ...topAnds(this.tag),
        ...topAnds(this.tag).map(queryPrefix),
        ...this.queryFilters,
    ].filter(t => t && !isQuery(t)));
  }

  @computed
  get noQuery() {
    return isQuery(this.tag) ? '' : this.tag;
  }

  @computed
  get localTag() {
    return localTag(this.tag);
  }

  @computed
  get name() {
    if (this.tag === '@*') return $localize`All`;
    if (this.tag === '*') return $localize`Local`;
    if (isQuery(this.tag)) return $localize`Query`;
    return this.exts[0]?.name || this.activeTemplates[0]?.name || this.viewExt?.name || this.viewExt?.tag || this.tag;
  }

  @computed
  get cols() {
    return parseInt(this.route.routeSnapshot?.queryParams['cols'] || this.viewExt?.config?.defaultCols || 0);
  }

  @computed
  get sort() {
    const sort = this.route.routeSnapshot?.queryParams['sort'];
    if (!sort) return [this.search ? this.defaultSearchSort : (this.viewExt?.config?.defaultSort || this.defaultSort)];
    if (!Array.isArray(sort)) return [sort]
    return sort;
  }

  @computed
  get isSorted() {
    if (this.sort.length > 1) return true;
    return this.sort[0] !== (this.search ? this.defaultSearchSort : (this.viewExt?.config?.defaultSort || this.defaultSort));
  }

  @computed
  get isVoteSorted() {
    return this.sort[0].startsWith('vote');
  }

  @computed
  get filter(): UrlFilter[] {
    const filter = this.route.routeSnapshot?.queryParams['filter'];
    if (!filter) return [];
    if (!Array.isArray(filter)) return [filter]
    return filter;
  }

  @computed
  get queryFilters(): string[] {
    return this.filter
      .filter(f => f.startsWith('query/'))
      .map(f => f.substring('query/'.length));
  }

  @computed
  get search() {
    return this.route.routeSnapshot?.queryParams['search'];
  }

  @computed
  get pageNumber() {
    return this.route.routeSnapshot?.queryParams['pageNumber'];
  }

  @computed
  get pageSize() {
    if (this.route.routeSnapshot?.queryParams['pageSize']) {
      return parseInt(this.route.routeSnapshot?.queryParams['pageSize']);
    }
    if (this.isTemplate('kanban')) return this.account.config.kanbanLoadSize || this.defaultKanbanLoadSize;
    return parseInt(this.route.routeSnapshot?.queryParams['pageSize'] ?? (this.isTemplate('blog') ? this.defaultBlogPageSize : this.defaultPageSize));
  }

  @computed
  get published() {
    return this.route.routeSnapshot?.queryParams['published'];
  }

  @computed
  get view(): string {
    return this.route.routeSnapshot?.queryParams['view'];
  }

  @computed
  get noView() {
    return !this.view;
  }

  @computed
  get list() {
    return this.view === 'list';
  }

  @computed
  get graph() {
    return this.view === 'graph';
  }

  @computed
  get showRemotes() {
    return this.route.routeSnapshot?.queryParams['showRemotes'] === 'true';
  }

  @action
  toggleTag(tag: string) {
    let query = this.tag;
    if (!query || query === '@*') return tag;
    if (query === tag) return '@*';
    if (query.includes(':' + tag)) return query.replace(':' + tag, '');
    if (query.includes(tag + ':')) return query.replace(tag + ':', '');
    if (query.includes('|')) query = '(' + query + ')';
    return query + ':' + tag;
  }

  @action
  toggleFilter(filter: UrlFilter) {
    const filters = this.filter;
    if (filters.includes(filter)) return without(filters, filter);
    return [...filters, filter];
  }

  @action
  updateNotify() {
    return this.updates = true;
  }
}
