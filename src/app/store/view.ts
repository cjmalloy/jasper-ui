import { uniq, without } from 'lodash-es';
import { action, autorun, makeAutoObservable, observable } from 'mobx';
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

  defaultPageSize = 24;
  defaultKanbanLoadSize = 8;
  defaultBlogPageSize = 5;
  defaultSort: RefSort | TagSort = 'published';
  defaultSearchSort: RefSort | TagSort = 'rank';
  ref?: Ref = {} as any;
  lastSelected?: Ref = {} as any;
  versions = 0;
  exts: Ext[] = [];
  extTemplates: Template[] = [];
  selectedUser?: User = {} as any;
  updates = false;

  constructor(
    public route: RouterStore,
    private account: AccountStore,
    private eventBus: EventBus,
  ) {
    makeAutoObservable(this, {
      clear: action,
      exts: observable.shallow,
      extTemplates: observable.shallow,
    });
    this.clear(); // Initial observables may not be null for MobX

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.ref?.url && this.eventBus.isRef(this.ref)) {
          this.setRef(this.eventBus.ref);
        }
      }
    });
  }

  setRef(ref?: Ref) {
    if (this.ref && !ref) {
      this.lastSelected = this.ref;
    }
    this.ref = ref;
    if (this.ref) {
      this.lastSelected = this.ref;
    }
  }

  clearLastSelected() {
    this.lastSelected = undefined;
  }

  clear(defaultSort: RefSort | TagSort = 'published', defaultSearchSort: RefSort | TagSort = 'rank') {
    this.ref = undefined;
    this.versions = 0;
    this.exts = [];
    this.extTemplates = [];
    this.selectedUser = undefined;
    this.defaultSort = defaultSort;
    this.defaultSearchSort = defaultSearchSort;
  }

  get ext() {
    if (this.exts.length === 1) return this.exts[0];
    return undefined;
  }

  get extTemplate() {
    return this.ext && this.extTemplates.find(t => hasPrefix(this.ext!.tag, t.tag))
  }

  get config(): RootConfig | undefined {
    return this.ext?.config;
  }

  get url() {
    return this.route.routeSnapshot?.firstChild?.params['url'];
  }

  get summary() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return !s.firstChild?.routeConfig?.path;
  }

  get missingSources() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return s.firstChild?.routeConfig?.path === 'missing';
  }

  get alternateUrls() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return s.firstChild?.routeConfig?.path === 'alts';
  }

  get activeExts(): Ext[] {
    return uniq(this.activeTemplates
        .flatMap(t => {
          const exts = this.exts.filter(x => x.modifiedString && hasPrefix(x.tag, t.tag));
          if (exts.length) return exts;
          return [{ tag: t.tag, origin: t.origin, name: t.config?.view || t.name, config: t.defaults }];
        })
        .filter(x => !!x));
  }

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

  get activeTemplates(): Template[] {
    return uniq(this.queryTags
        .map(tag => this.extTemplates.find(t => hasPrefix(tag, t.tag))!)
        .filter(t => !!t));
  }

  get globalTemplates(): Template[] {
    return this.extTemplates.filter(t => t.config?.global);
  }

  get hasTemplate() {
    return !!this.activeTemplates.length && !!this.globalTemplates.length;
  }

  isTemplate(template: string) {
    return hasPrefix(this.viewExt?.tag, template);
  }

  get tags(): boolean {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.url[0].path === 'tags';
  }

  get allTags(): boolean {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.url[0].path === 'tags' && !s?.params.template;
  }

  get settings() {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'settings';
  }

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

  get alarm(): boolean {
    return this.account.alarms.includes(this.tag);
  }

  get tag(): string {
    return this.route.routeSnapshot?.firstChild?.params['tag'] || '';
  }

  get viewTag(): string {
    return this.view || this.activeExts[0]?.tag || '';
  }

  get viewExt() {
    return [...this.activeExts, ...this.globalExts].find(x => x.tag === this.viewTag);
  }

  get template(): string {
    return this.route.routeSnapshot?.firstChild?.params['template'] || '';
  }

  get localTemplate(): string {
    return localTag(this.template);
  }

  get userTemplate() {
    return hasPrefix(this.localTemplate, 'user');
  }

  get noTemplate(): boolean {
    return this.route.routeSnapshot?.queryParams['noTemplate'] === 'true';
  }

  get home(): boolean {
    return this.route.routeSnapshot?.queryParams['home'] === 'true';
  }

  get query() {
    return isQuery(this.tag) ? this.tag : '';
  }

  get queryTags() {
    return uniq([
        ...topAnds(this.tag),
        ...topAnds(this.tag).map(queryPrefix),
        ...this.queryFilters,
    ].filter(t => t && !isQuery(t)));
  }

  get noQuery() {
    return isQuery(this.tag) ? '' : this.tag;
  }

  get localTag() {
    return localTag(this.tag);
  }

  get name() {
    if (this.tag === '@*') return $localize`All`;
    if (this.tag === '*') return $localize`Local`;
    if (isQuery(this.tag)) return $localize`Query`;
    return this.ext?.name || this.activeTemplates[0]?.name || this.ext?.tag || this.tag;
  }

  get sort() {
    const sort = this.route.routeSnapshot?.queryParams['sort'];
    if (!sort) return [this.search ? this.defaultSearchSort : (this.ext?.config?.defaultSort || this.defaultSort)];
    if (!Array.isArray(sort)) return [sort]
    return sort;
  }

  get isSorted() {
    if (this.sort.length > 1) return true;
    return this.sort[0] !== (this.search ? this.defaultSearchSort : (this.ext?.config?.defaultSort || this.defaultSort));
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

  get queryFilters(): string[] {
    return this.filter
      .filter(f => f.startsWith('query/'))
      .map(f => f.substring('query/'.length));
  }

  get search() {
    return this.route.routeSnapshot?.queryParams['search'];
  }

  get pageNumber() {
    return this.route.routeSnapshot?.queryParams['pageNumber'];
  }

  get pageSize() {
    if (this.route.routeSnapshot?.queryParams['pageSize']) {
      return parseInt(this.route.routeSnapshot?.queryParams['pageSize']);
    }
    if (this.isTemplate('kanban')) return this.account.config.kanbanLoadSize || this.defaultKanbanLoadSize;
    return parseInt(this.route.routeSnapshot?.queryParams['pageSize'] ?? (this.isTemplate('blog') ? this.defaultBlogPageSize : this.defaultPageSize));
  }

  get published() {
    return this.route.routeSnapshot?.queryParams['published'];
  }

  get view(): string {
    return this.route.routeSnapshot?.queryParams['view'];
  }

  get noView() {
    return !this.view;
  }

  get list() {
    return this.view === 'list';
  }

  get graph() {
    return this.view === 'graph';
  }

  get showRemotes() {
    return this.route.routeSnapshot?.queryParams['showRemotes'] === 'true';
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
