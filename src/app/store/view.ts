import { isEqual, uniq } from 'lodash-es';
import { action, makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref, RefSort } from '../model/ref';
import { TagSort } from '../model/tag';
import { Template } from '../model/template';
import { User } from '../model/user';
import { RootConfig } from '../mods/root';
import { getPageTitle } from '../util/format';
import { UrlFilter } from '../util/query';
import { hasPrefix, hasTag, isQuery, localTag, queryPrefix, top, topAnds } from '../util/tag';
import { AccountStore } from './account';

/**
 * ID for current view. Only includes pages that make queries.
 * For example, the alt refs and missing refs pages are not included since
 * they do not make queries.
 */
export type View =
  'home' | 'all' | 'local' |
  'tag' | 'tags' | 'query' | 'browse' |
  'inbox/all' | 'inbox/sent' | 'inbox/alarms' | 'inbox/dms' | 'inbox/modlist' | 'inbox/reports' | 'inbox/ref' |
  'ref/summary' | 'ref/comments' | 'ref/thread' | 'ref/responses' | 'ref/errors' | 'ref/sources' | 'ref/alts' | 'ref/versions' |
  'settings/user' | 'settings/plugin' | 'settings/template' | 'settings/ref';

export type Type = 'ref' | 'ext' | 'user' | 'plugin' | 'template';

export class ViewStore {

  floatingSidebar = true;
  sidebarExpanded = true;
  defaultPageSize = 24;
  defaultKanbanLoadSize = 8;
  defaultBlogPageSize = 5;
  defaultSort: RefSort[] | TagSort[] = ['published'];
  defaultSearchSort: RefSort[] | TagSort[] = ['rank'];
  defaultPageNumber = 0;
  ref?: Ref = {} as any;
  top?: Ref = {} as any;
  lastSelected?: Ref = {} as any;
  versions = 0;
  exts: Ext[] = [];
  extTemplates: Template[] = [];
  selectedUser?: User = {} as any;
  updates = false;
  inboxTabs: Plugin[] = [];
  settingsTabs: Plugin[] = [];

  constructor(
    public route: RouterStore,
    private account: AccountStore,
  ) {
    makeAutoObservable(this, {
      clear: action,
      setRef: action,
      preloadRef: action,
      setLastSelected: action,
      exts: observable.shallow,
      extTemplates: observable.shallow,
      inboxTabs: observable.shallow,
      settingsTabs: observable.shallow,
    });
    this.clear(); // Initial observables may not be null for MobX
  }

  setLastSelected(ref?: Ref) {
    this.lastSelected = ref;
  }

  clearLastSelected(url?: string) {
    if (!url || url === this.lastSelected?.url) {
      this.lastSelected = undefined;
    }
  }

  clear(defaultSort: RefSort[] | TagSort[] = ['published'], defaultSearchSort: RefSort[] | TagSort[] = ['rank'], defaultPageNumber = 0) {
    this.ref = undefined;
    this.top = undefined;
    this.versions = 0;
    this.exts = [];
    this.extTemplates = [];
    this.selectedUser = undefined;
    this.defaultSort = defaultSort;
    this.defaultSearchSort = defaultSearchSort;
    this.defaultPageNumber = defaultPageNumber;
  }

  clearRef(ref?: Ref) {
    if (this.ref && (!ref || ref.url !== this.ref?.url)) this.lastSelected = this.ref;
    this.ref = undefined;
    this.top = undefined;
  }

  setRef(ref?: Ref, top?: Ref) {
    this.clearRef(ref);
    this.ref = ref;
    this.top = top;
    this.exts = [];
    this.extTemplates = [];
    this.selectedUser = undefined;
  }

  preloadRef(ref: Ref, topRef?: Ref) {
    this.clearRef(ref);
    if (ref?.created) this.ref = ref;
    if (topRef || top(ref) !== this.top?.url) this.top = topRef;
  }

  get pageTitle() {
    return getPageTitle(this.ref, this.top);
  }

  get ext() {
    return this.exts[0];
  }

  get extTemplate() {
    return this.extTemplates.find(t => this.exts.find(x => hasPrefix(x.tag, t.tag)));
  }

  get config(): RootConfig | undefined {
    return this.viewExt?.config;
  }

  get url() {
    return this.route.routeSnapshot?.firstChild?.params['url'];
  }

  get summary() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return !s.firstChild?.routeConfig?.path;
  }

  get alternateUrls() {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return s.firstChild?.routeConfig?.path === 'alts';
  }

  /**
   * Exts for all active Templates. If no Ext is found a default will be created.
   */
  get activeExts(): Ext[] {
    return uniq(this.activeTemplates
        .flatMap(t => {
          const exts = this.exts.filter(x => x.modifiedString && hasPrefix(x.tag, t.tag));
          if (exts.length) return exts;
          return [{ tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, view: t?.config?.view} }];
        })
        .filter(x => !!x));
  }

  /**
   * Exts for all global Templates. If no Ext is found a default will be created.
   */
  get globalExts(): Ext[] {
    return uniq(this.globalTemplates
        .flatMap(t => {
          if (this.exts.find(x => hasPrefix(x.tag, t.tag))) {
            // Already an active ext so ignore global
            return [];
          }
          return [{ tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, view: t.config?.view } }];
        })
        .filter(x => !!x));
  }

  /**
   * Templates found in top ands of query or filters.
   */
  get activeTemplates(): Template[] {
    return uniq(this.queryTags
        .map(tag => this.extTemplates.find(t => hasPrefix(tag, t.tag))!)
        .filter(t => !!t));
  }

  get globalTemplates(): Template[] {
    return this.extTemplates.filter(t => t.config?.global);
  }

  isTemplate(template: string) {
    return hasPrefix(this.viewExt?.tag, template);
  }

  get tags(): boolean {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.url[0].path === 'tags';
  }

  get settings() {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'settings';
  }

  get settingsTag() {
    if (!this.settings) return '';
    return this.childTag;
  }

  get inbox() {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'inbox';
  }

  get inboxTag() {
    if (!this.inbox) return '';
    return this.childTag;
  }

  get browser() {
    return this.current === 'browse';
  }

  get refPath() {
    return this.browser ? '/browse' : '/ref';
  }

  get current(): View | undefined {
    const s = this.route.routeSnapshot?.firstChild;
    switch (s?.url[0].path) {
      case 'home': return 'home';
      case 'tags': return 'tags';
      case 'tag':
        if (this.tag === '@*') return 'all';
        if (this.tag === '*') return 'local';
        if (isQuery(this.tag)) return 'query';
        return 'tag';
      case 'browse': return 'browse';
      case 'ref':
        switch (s.firstChild?.routeConfig?.path) {
          case '': return 'ref/summary';
          case 'comments': return 'ref/comments';
          case 'thread': return 'ref/thread';
          case 'responses': return 'ref/responses';
          case 'errors': return 'ref/errors';
          case 'sources': return 'ref/sources';
          case 'versions': return 'ref/versions';
          case 'alts': return 'ref/alts';
        }
        return undefined;
      case 'settings':
        switch (s.firstChild?.routeConfig?.path) {
          case 'user': return 'settings/user';
          case 'plugin': return 'settings/plugin';
          case 'template': return 'settings/template';
          case 'ref/:tag': return 'settings/ref';
        }
        return undefined;
      case 'inbox':
        switch (s.firstChild?.routeConfig?.path) {
          case 'all': return 'inbox/all';
          case 'sent': return 'inbox/sent';
          case 'alarms': return 'inbox/alarms';
          case 'dms': return 'inbox/dms';
          case 'modlist': return 'inbox/modlist';
          case 'reports': return 'inbox/reports';
          case 'ref/:tag': return 'inbox/ref';
        }
        return undefined;
    }
    return undefined;
  }

  get originFilter() {
    return this.filter?.some(f => f.startsWith('query/@') || f === 'query/*');
  }

  get showRemotesCheckbox() {
    if (this.originFilter) return false;
    return ['tags', 'settings/user', 'settings/plugin', 'settings/template', 'settings/ref', 'inbox/ref'].includes(this.current!);
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
    if (this.current.startsWith('settings/')) {
      return this.current.substring('settings/'.length) as Type;
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

  get childTag(): string {
    return this.route.routeSnapshot?.firstChild?.firstChild?.params['tag'] || '';
  }

  /**
   * The main tag associated with this view.
   */
  get viewTag(): string {
    return this.view || this.activeExts[0]?.tag || '';
  }

  /**
   * The main Ext associated with this view.
   */
  get viewExt() {
    if (this.list) return undefined;
    return this.viewTag && [...this.activeExts, ...this.globalExts].find(x => hasPrefix(x.tag, this.viewTag)) || this.exts[0];
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
    return this.route.routeSnapshot?.queryParams['noTemplate'] !== undefined && this.route.routeSnapshot?.queryParams['noTemplate'] !== 'false';
  }

  get home(): boolean {
    return this.route.routeSnapshot?.queryParams['home'] !== undefined && this.route.routeSnapshot?.queryParams['home'] !== 'false';
  }

  get query() {
    return isQuery(this.tag) ? this.tag : '';
  }

  get queryTags() {
    return uniq([
        ...topAnds(this.tag).map(queryPrefix),
        ...this.queryFilters.map(queryPrefix),
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
    return this.exts[0]?.name || this.viewExt?.name || (this.viewExt?.tag || this.tag).substring(this.tag.lastIndexOf('/') + 1);
  }

  get cols() {
    return parseInt(this.route.routeSnapshot?.queryParams['cols'] || this.viewExt?.config?.defaultCols || 0);
  }

  get viewExtSort() {
    if (!['tag', 'home'].includes(this.current!)) return undefined;
    return this.viewExt?.config?.defaultSort;
  }

  get viewExtFilter() {
    if (!['tag', 'home'].includes(this.current!)) return undefined;
    return this.viewExt?.config?.defaultFilter;
  }

  get sort() {
    const sort = this.route.routeSnapshot?.queryParams['sort'];
    if (!sort) {
      if (this.search && this.defaultSearchSort) return this.defaultSearchSort;
      return this.viewExtSort || this.defaultSort || [];
    }
    if (!Array.isArray(sort)) return [sort]
    return sort;
  }

  get isSorted() {
    if (this.sort.length > 1) return true;
    if (this.search && this.defaultSearchSort) return !isEqual(this.sort, this.defaultSearchSort);
    return !isEqual(this.sort, this.defaultSort);
  }

  get isVoteSorted() {
    return this.sort[0]?.startsWith('vote');
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
    return this.route.routeSnapshot?.queryParams['pageNumber'] || this.defaultPageNumber;
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
    if (!this.showRemotesCheckbox) return true;
    return this.route.routeSnapshot?.queryParams['showRemotes'] !== undefined && this.route.routeSnapshot?.queryParams['showRemotes'] !== 'false';
  }

  get repost() {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  }

  updateNotify() {
    return this.updates = true;
  }
}
