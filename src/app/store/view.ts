import { computed, signal } from '@angular/core';
import { isEqual, uniq } from 'lodash-es';
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
import { RouterStore } from './router';

function getQueryTags(tag: string, filters: UrlFilter[]) {
  return uniq([
    ...topAnds(tag).map(queryPrefix),
    ...filters
      .filter(f => f.startsWith('query/'))
      .map(f => queryPrefix(f.substring('query/'.length))),
  ].filter(t => t && !isQuery(t)));
}

/**
 * ID for current view. Only includes pages that make queries.
 * For example, the alt refs and missing refs pages are not included since
 * they do not make queries.
 */
export type View =
  'home' | 'all' | 'local' |
  'tag' | 'tags' | 'query' |
  'inbox/all' | 'inbox/sent' | 'inbox/alarms' | 'inbox/dms' | 'inbox/modlist' | 'inbox/reports' | 'inbox/ref' |
  'ref/summary' | 'ref/comments' | 'ref/thread' | 'ref/responses' | 'ref/errors' | 'ref/sources' | 'ref/alts' | 'ref/versions' |
  'settings/user' | 'settings/plugin' | 'settings/template' | 'settings/ref';

export type Type = 'ref' | 'ext' | 'user' | 'plugin' | 'template';

export class ViewStore {

  private readonly _back = signal(false);
  private readonly _floatingSidebar = signal(true);
  private readonly _sidebarExpanded = signal(true);
  private readonly _defaultSort = signal<RefSort[] | TagSort[]>(['published']);
  private readonly _defaultSearchSort = signal<RefSort[] | TagSort[]>(['rank']);
  private readonly _defaultPageNumber = signal(0);
  private readonly _ref = signal<Ref | undefined>(undefined);
  private readonly _top = signal<Ref | undefined>(undefined);
  private readonly _lastSelected = signal<Ref | undefined>(undefined);
  private readonly _versions = signal(0);
  private readonly _exts = signal<Ext[]>([]);
  private readonly _extTemplates = signal<Template[]>([]);
  private readonly _selectedUser = signal<User | undefined>(undefined);
  private readonly _modChanges = signal(new Map<string, boolean>());
  private readonly _modUpdates = signal(new Set<string>());
  private readonly _inboxTabs = signal<Plugin[]>([]);
  private readonly _settingsTabs = signal<Plugin[]>([]);

  defaultPageSize = 24;
  defaultKanbanLoadSize = 8;
  defaultBlogPageSize = 5;

  constructor(
    public route: RouterStore,
    private account: AccountStore,
  ) { }

  get back() { return this._back(); }
  set back(value: boolean) { this._back.set(value); }

  get floatingSidebar() { return this._floatingSidebar(); }
  set floatingSidebar(value: boolean) { this._floatingSidebar.set(value); }

  get sidebarExpanded() { return this._sidebarExpanded(); }
  set sidebarExpanded(value: boolean) { this._sidebarExpanded.set(value); }

  get defaultSort() { return this._defaultSort(); }
  set defaultSort(value: RefSort[] | TagSort[]) { this._defaultSort.set(value); }

  get defaultSearchSort() { return this._defaultSearchSort(); }
  set defaultSearchSort(value: RefSort[] | TagSort[]) { this._defaultSearchSort.set(value); }

  get defaultPageNumber() { return this._defaultPageNumber(); }
  set defaultPageNumber(value: number) { this._defaultPageNumber.set(value); }

  get ref() { return this._ref(); }
  set ref(value: Ref | undefined) { this._ref.set(value); }

  get top() { return this._top(); }
  set top(value: Ref | undefined) { this._top.set(value); }

  get lastSelected() { return this._lastSelected(); }
  set lastSelected(value: Ref | undefined) { this._lastSelected.set(value); }

  get versions() { return this._versions(); }
  set versions(value: number) { this._versions.set(value); }

  get exts() { return this._exts(); }
  set exts(value: Ext[]) { this._exts.set(value); }

  get extTemplates() { return this._extTemplates(); }
  set extTemplates(value: Template[]) { this._extTemplates.set(value); }

  get selectedUser() { return this._selectedUser(); }
  set selectedUser(value: User | undefined) { this._selectedUser.set(value); }

  get inboxTabs() { return this._inboxTabs(); }
  set inboxTabs(value: Plugin[]) { this._inboxTabs.set(value); }

  get settingsTabs() { return this._settingsTabs(); }
  set settingsTabs(value: Plugin[]) { this._settingsTabs.set(value); }

  /**
   * Read only. Use setModChange() and clearModChanges() to modify.
   */
  get modChanges(): ReadonlyMap<string, boolean> { return this._modChanges(); }

  /**
   * Read only. Use addModUpdate() and clearModChanges() to modify.
   */
  get modUpdates(): ReadonlySet<string> { return this._modUpdates(); }

  setModChange(mod: string, changed: boolean) {
    this._modChanges.update(m => new Map(m).set(mod, changed));
  }

  addModUpdate(mod: string) {
    this._modUpdates.update(s => new Set(s).add(mod));
  }

  clearModChanges() {
    this._modChanges.set(new Map());
    this._modUpdates.set(new Set());
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
    if (this.back && this.ref && (!ref || ref.url !== this.ref?.url)) this.lastSelected = this.ref;
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

  private readonly _pageTitle = computed(() => {
    return getPageTitle(this.ref, this.top);
  });
  get pageTitle() {
    return this._pageTitle();
  }

  private readonly _ext = computed(() => {
    return this.exts[0];
  });
  get ext() {
    return this._ext();
  }

  private readonly _extTemplate = computed(() => {
    return this.extTemplates.find(t => this.exts.find(x => hasPrefix(x.tag, t.tag)));
  });
  get extTemplate() {
    return this._extTemplate();
  }

  private readonly _config = computed((): RootConfig | undefined => {
    return this.viewExt?.config;
  });
  get config(): RootConfig | undefined {
    return this._config();
  }

  private readonly _url = computed(() => {
    return this.route.routeSnapshot?.firstChild?.params['url'];
  });
  get url() {
    return this._url();
  }

  private readonly _summary = computed(() => {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return !s.firstChild?.routeConfig?.path;
  });
  get summary() {
    return this._summary();
  }

  private readonly _alternateUrls = computed(() => {
    const s = this.route.routeSnapshot?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return s.firstChild?.routeConfig?.path === 'alts';
  });
  get alternateUrls() {
    return this._alternateUrls();
  }

  /**
   * Exts for all active Templates. If no Ext is found a default will be created.
   */
  private readonly _activeExts = computed((): Ext[] => {
    return uniq(this.activeTemplates
        .flatMap(t => {
          const exts = this.exts.filter(x => x.modifiedString && hasPrefix(x.tag, t.tag));
          if (exts.length) return exts;
          return [{ tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, tab: t?.config?.tab, view: t?.config?.view } }];
        })
        .filter(x => !!x));
  });
  get activeExts(): Ext[] {
    return this._activeExts();
  }

  /**
   * Exts for all global Templates. If no Ext is found a default will be created.
   */
  private readonly _globalExts = computed((): Ext[] => {
    return uniq(this.globalTemplates
        .flatMap(t => {
          if (this.exts.find(x => hasPrefix(x.tag, t.tag))) {
            // Already an active ext so ignore global
            return [];
          }
          return [{ tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, tab: t.config?.tab, view: t.config?.view } }];
        })
        .filter(x => !!x));
  });
  get globalExts(): Ext[] {
    return this._globalExts();
  }

  /**
   * Templates found in top ands of query or filters.
   */
  private readonly _activeTemplates = computed((): Template[] => {
    return uniq(this.urlQueryTags
        .map(tag => this.extTemplates.find(t => hasPrefix(tag, t.tag))!)
        .filter(t => !!t));
  });
  get activeTemplates(): Template[] {
    return this._activeTemplates();
  }

  private readonly _globalTemplates = computed((): Template[] => {
    return this.extTemplates.filter(t => t.config?.global);
  });
  get globalTemplates(): Template[] {
    return this._globalTemplates();
  }

  isTemplate(template: string) {
    return hasPrefix(this.viewExt?.tag, template);
  }

  private readonly _tags = computed((): boolean => {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.url[0].path === 'tags';
  });
  get tags(): boolean {
    return this._tags();
  }

  private readonly _settings = computed(() => {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'settings';
  });
  get settings() {
    return this._settings();
  }

  private readonly _settingsTag = computed(() => {
    if (!this.settings) return '';
    return this.childTag;
  });
  get settingsTag() {
    return this._settingsTag();
  }

  private readonly _settingsExt = computed(() => {
    return this.settingsTabs.find(t => t.tag === this.settingsTag) as Ext;
  });
  get settingsExt() {
    return this._settingsExt();
  }

  private readonly _inbox = computed(() => {
    const s = this.route.routeSnapshot?.firstChild;
    return s?.routeConfig?.path === 'inbox';
  });
  get inbox() {
    return this._inbox();
  }

  private readonly _inboxTag = computed(() => {
    if (!this.inbox) return '';
    return this.childTag;
  });
  get inboxTag() {
    return this._inboxTag();
  }

  private readonly _current = computed((): View | undefined => {
    const s = this.route.routeSnapshot?.firstChild;
    switch (s?.url[0].path) {
      case 'home': return 'home';
      case 'tags': return 'tags';
      case 'tag':
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
  });
  get current(): View | undefined {
    return this._current();
  }

  private readonly _originFilter = computed(() => {
    return this.filter?.some(f => f.startsWith('query/@') || f === 'query/*');
  });
  get originFilter() {
    return this._originFilter();
  }

  private readonly _showRemotesCheckbox = computed(() => {
    if (this.originFilter) return false;
    return ['tags', 'settings/user', 'settings/plugin', 'settings/template', 'settings/ref', 'inbox/ref'].includes(this.current!);
  });
  get showRemotesCheckbox() {
    return this._showRemotesCheckbox();
  }

  private readonly _type = computed((): Type | undefined => {
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
  });
  get type(): Type | undefined {
    return this._type();
  }

  private readonly _forYou = computed(() => {
    return !!this.route.routeSnapshot?.queryParams['forYou'];
  });
  get forYou() {
    return this._forYou();
  }

  private readonly _origin = computed(() => {
    return this.route.routeSnapshot?.queryParams['origin'];
  });
  get origin() {
    return this._origin();
  }

  private readonly _depth = computed(() => {
    return this.route.routeSnapshot?.queryParams['depth'];
  });
  get depth() {
    return this._depth();
  }

  private readonly _isTextPost = computed(() => {
    return this.url?.startsWith('comment:');
  });
  get isTextPost() {
    return this._isTextPost();
  }

  private readonly _alarm = computed((): boolean => {
    return this.account.alarms.includes(this.tag);
  });
  get alarm(): boolean {
    return this._alarm();
  }

  private readonly _tag = computed((): string => {
    return this.route.routeSnapshot?.firstChild?.params['tag'] || '';
  });
  get tag(): string {
    return this._tag();
  }

  private readonly _childTag = computed((): string => {
    return this.route.routeSnapshot?.firstChild?.firstChild?.params['tag'] || '';
  });
  get childTag(): string {
    return this._childTag();
  }

  /**
   * The main tag associated with this view.
   */
  private readonly _viewTag = computed((): string => {
    return this.view || this.activeExts[0]?.tag || '';
  });
  get viewTag(): string {
    return this._viewTag();
  }

  /**
   * The main Ext associated with this view.
   */
  private readonly _viewExt = computed(() => {
    if (this.list) return undefined;
    return this.viewTag && [...this.activeExts, ...this.globalExts].find(x => hasPrefix(x.tag, this.viewTag)) || this.exts[0];
  });
  get viewExt() {
    return this._viewExt();
  }

  private readonly _homeExt = computed(() => {
    if (this.list) return this.ext;
    return {
      ...this.ext || {},
      config: {
        ...this.ext?.config || {},
        noFloatingSidebar: this.viewExt?.config?.noFloatingSidebar ?? this.ext?.config?.noFloatingSidebar,
      },
    };
  });
  get homeExt() {
    return this._homeExt();
  }

  private readonly _template = computed((): string => {
    return this.route.routeSnapshot?.firstChild?.params['template'] || '';
  });
  get template(): string {
    return this._template();
  }

  private readonly _localTemplate = computed((): string => {
    return localTag(this.template);
  });
  get localTemplate(): string {
    return this._localTemplate();
  }

  private readonly _userTemplate = computed(() => {
    return hasPrefix(this.localTemplate, 'user');
  });
  get userTemplate() {
    return this._userTemplate();
  }

  private readonly _noTemplate = computed((): boolean => {
    return this.route.routeSnapshot?.queryParams['noTemplate'] !== undefined && this.route.routeSnapshot?.queryParams['noTemplate'] !== 'false';
  });
  get noTemplate(): boolean {
    return this._noTemplate();
  }

  private readonly _home = computed((): boolean => {
    return this.route.routeSnapshot?.queryParams['home'] !== undefined && this.route.routeSnapshot?.queryParams['home'] !== 'false';
  });
  get home(): boolean {
    return this._home();
  }

  private readonly _query = computed(() => {
    return isQuery(this.tag) ? this.tag : '';
  });
  get query() {
    return this._query();
  }

  private readonly _urlQueryTags = computed(() => {
    return getQueryTags(this.tag, this.urlFilters);
  });
  get urlQueryTags() {
    return this._urlQueryTags();
  }

  private readonly _queryTags = computed(() => {
    return getQueryTags(this.tag, this.filter);
  });
  get queryTags() {
    return this._queryTags();
  }

  private readonly _noQuery = computed(() => {
    return isQuery(this.tag) ? '' : this.tag;
  });
  get noQuery() {
    return this._noQuery();
  }

  private readonly _localTag = computed(() => {
    return localTag(this.tag);
  });
  get localTag() {
    return this._localTag();
  }

  private readonly _name = computed(() => {
    if (this.tag === '@*') return $localize`All`;
    if (this.tag === '*') return $localize`Local`;
    if (isQuery(this.tag)) return $localize`Query`;
    return this.exts[0]?.name || this.viewExt?.name || (this.viewExt?.tag || this.tag).substring(this.tag.lastIndexOf('/') + 1);
  });
  get name() {
    return this._name();
  }

  private readonly _cols = computed(() => {
    return parseInt(this.route.routeSnapshot?.queryParams['cols'] || this.viewExt?.config?.defaultCols || 0);
  });
  get cols() {
    return this._cols();
  }

  private readonly _viewExtSort = computed(() => {
    if (this.current === 'home') return this.ext?.config?.defaultSort;
    if (this.current !== 'tag') return undefined;
    return this.viewExt?.config?.defaultSort;
  });
  get viewExtSort() {
    return this._viewExtSort();
  }

  private readonly _viewExtFilter = computed(() => {
    if (this.current === 'home') return this.ext?.config?.defaultFilter;
    if (this.current !== 'tag') return undefined;
    return this.viewExt?.config?.defaultFilter;
  });
  get viewExtFilter() {
    return this._viewExtFilter();
  }

  private readonly _sort = computed(() => {
    const sort = this.route.routeSnapshot?.queryParams['sort'];
    if (!sort) {
      if (this.search && this.defaultSearchSort) return this.defaultSearchSort;
      return this.viewExtSort || this.defaultSort || [];
    }
    if (!Array.isArray(sort)) return [sort]
    return sort;
  });
  get sort() {
    return this._sort();
  }

  private readonly _isSorted = computed(() => {
    if (this.sort.length > 1) return true;
    if (this.search && this.defaultSearchSort) return !isEqual(this.sort, this.defaultSearchSort);
    return !isEqual(this.sort, this.defaultSort);
  });
  get isSorted() {
    return this._isSorted();
  }

  private readonly _isVoteSorted = computed(() => {
    return this.sort[0]?.startsWith('plugins->plugin/user/vote');
  });
  get isVoteSorted() {
    return this._isVoteSorted();
  }

  private readonly _urlFilters = computed((): UrlFilter[] => {
    const filter = this.route.routeSnapshot?.queryParams['filter'];
    if (!filter) return [];
    if (!Array.isArray(filter)) return [filter];
    return filter;
  });
  get urlFilters(): UrlFilter[] {
    return this._urlFilters();
  }

  private readonly _filter = computed((): UrlFilter[] => {
    return this.urlFilters.length ? this.urlFilters : this.viewExtFilter || [];
  });
  get filter(): UrlFilter[] {
    return this._filter();
  }

  private readonly _queryFilters = computed((): string[] => {
    return this.filter
      .filter(f => f.startsWith('query/'))
      .map(f => f.substring('query/'.length));
  });
  get queryFilters(): string[] {
    return this._queryFilters();
  }

  private readonly _search = computed(() => {
    return this.route.routeSnapshot?.queryParams['search'];
  });
  get search() {
    return this._search();
  }

  private readonly _isSearch = computed(() => {
    return !!this.search;
  });
  get isSearch() {
    return this._isSearch();
  }

  private readonly _pageNumber = computed(() => {
    return this.route.routeSnapshot?.queryParams['pageNumber'] || this.defaultPageNumber;
  });
  get pageNumber() {
    return this._pageNumber();
  }

  private readonly _pageSize = computed(() => {
    if (this.route.routeSnapshot?.queryParams['pageSize']) {
      return parseInt(this.route.routeSnapshot?.queryParams['pageSize']);
    }
    if (this.isTemplate('kanban')) return this.account.config.kanbanLoadSize || this.defaultKanbanLoadSize;
    return parseInt(this.route.routeSnapshot?.queryParams['pageSize'] ?? (this.isTemplate('blog') ? this.defaultBlogPageSize : this.defaultPageSize));
  });
  get pageSize() {
    return this._pageSize();
  }

  private readonly _published = computed(() => {
    return this.route.routeSnapshot?.queryParams['published'];
  });
  get published() {
    return this._published();
  }

  private readonly _view = computed((): string => {
    return this.route.routeSnapshot?.queryParams['view'];
  });
  get view(): string {
    return this._view();
  }

  private readonly _noView = computed(() => {
    return !this.view;
  });
  get noView() {
    return this._noView();
  }

  private readonly _list = computed(() => {
    return this.view === 'list';
  });
  get list() {
    return this._list();
  }

  private readonly _graph = computed(() => {
    return this.view === 'graph';
  });
  get graph() {
    return this._graph();
  }

  private readonly _showRemotes = computed(() => {
    if (!this.showRemotesCheckbox) return true;
    return this.route.routeSnapshot?.queryParams['showRemotes'] !== undefined && this.route.routeSnapshot?.queryParams['showRemotes'] !== 'false';
  });
  get showRemotes() {
    return this._showRemotes();
  }

  private readonly _repost = computed(() => {
    return this.ref?.sources?.[0] && hasTag('plugin/repost', this.ref);
  });
  get repost() {
    return this._repost();
  }
}
