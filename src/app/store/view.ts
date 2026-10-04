import { computed, linkedSignal, signal } from '@angular/core';
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

  readonly back = signal(false);
  readonly floatingSidebar = signal(true);
  readonly sidebarExpanded = signal(true);
  readonly defaultSort = signal<RefSort[] | TagSort[]>(['published']);
  readonly defaultSearchSort = signal<RefSort[] | TagSort[]>(['rank']);
  readonly defaultPageNumber = signal(0);
  readonly ref = signal<Ref | undefined>(undefined);
  readonly top = signal<Ref | undefined>(undefined);
  readonly lastSelected = signal<Ref | undefined>(undefined);
  readonly versions = signal(0);
  private readonly extsSource = signal<() => Ext[]>(() => []);
  /**
   * Exts for the current view. Pages bind a reactive source with {@link watchExts},
   * or set the value directly.
   */
  readonly exts = linkedSignal(() => this.extsSource()(), {
    equal: (a, b) => isEqual(a.map(x => x.tag + x.origin + x.modifiedString).sort(), b.map(x => x.tag + x.origin + x.modifiedString).sort()),
  });
  readonly extTemplates = signal<Template[]>([]);
  readonly selectedUser = signal<User | undefined>(undefined);
  /**
   * Read only. Use setModChange() and clearModChanges() to modify.
   */
  readonly modChanges = signal<ReadonlyMap<string, boolean>>(new Map());
  /**
   * Read only. Use addModUpdate() and clearModChanges() to modify.
   */
  readonly modUpdates = signal<ReadonlySet<string>>(new Set());
  readonly inboxTabs = signal<Plugin[]>([]);
  readonly settingsTabs = signal<Plugin[]>([]);

  defaultPageSize = 24;
  defaultKanbanLoadSize = 8;
  defaultBlogPageSize = 5;

  constructor(
    public route: RouterStore,
    private account: AccountStore,
  ) { }

  watchExts(source: () => Ext[]) {
    this.extsSource.set(source);
  }

  setModChange(mod: string, changed: boolean) {
    this.modChanges.update(m => new Map(m).set(mod, changed));
  }

  addModUpdate(mod: string) {
    this.modUpdates.update(s => new Set(s).add(mod));
  }

  clearModChanges() {
    this.modChanges.set(new Map());
    this.modUpdates.set(new Set());
  }

  setLastSelected(ref?: Ref) {
    this.lastSelected.set(ref);
  }

  clearLastSelected(url?: string) {
    if (!url || url === this.lastSelected()?.url) {
      this.lastSelected.set(undefined);
    }
  }

  clear(defaultSort: RefSort[] | TagSort[] = ['published'], defaultSearchSort: RefSort[] | TagSort[] = ['rank'], defaultPageNumber = 0) {
    this.ref.set(undefined);
    this.top.set(undefined);
    this.versions.set(0);
    this.extsSource.set(() => []);
    this.exts.set([]);
    this.extTemplates.set([]);
    this.selectedUser.set(undefined);
    this.defaultSort.set(defaultSort.slice());
    this.defaultSearchSort.set(defaultSearchSort.slice());
    this.defaultPageNumber.set(defaultPageNumber);
  }

  clearRef(ref?: Ref) {
    if (this.back() && this.ref() && (!ref || ref.url !== this.ref()?.url)) this.lastSelected.set(this.ref());
    this.ref.set(undefined);
    this.top.set(undefined);
  }

  setRef(ref?: Ref, top?: Ref) {
    this.clearRef(ref);
    this.ref.set(ref);
    this.top.set(top);
    this.exts.set([]);
    this.extTemplates.set([]);
    this.selectedUser.set(undefined);
  }

  preloadRef(ref: Ref, topRef?: Ref) {
    this.clearRef(ref);
    if (ref?.created) this.ref.set(ref);
    if (topRef || top(ref) !== this.top()?.url) this.top.set(topRef);
  }

  readonly pageTitle = computed(() => {
    return getPageTitle(this.ref(), this.top());
  });

  readonly ext = computed(() => {
    return this.exts()[0];
  });

  readonly extTemplate = computed(() => {
    return this.extTemplates().find(t => this.exts().find(x => hasPrefix(x.tag, t.tag)));
  });

  readonly config = computed((): RootConfig | undefined => {
    return this.viewExt()?.config;
  });

  readonly url = computed(() => {
    return this.route.routeSnapshot()?.firstChild?.params['url'];
  });

  readonly summary = computed(() => {
    const s = this.route.routeSnapshot()?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return !s.firstChild?.routeConfig?.path;
  });

  readonly alternateUrls = computed(() => {
    const s = this.route.routeSnapshot()?.firstChild;
    if (s?.url[0].path !== 'ref') return false;
    return s.firstChild?.routeConfig?.path === 'alts';
  });

  /**
   * Exts for all active Templates. If no Ext is found a default will be created.
   */
  readonly activeExts = computed((): Ext[] => {
    return uniq(this.activeTemplates()
        .flatMap(t => {
          const exts = this.exts().filter(x => x.modifiedString && hasPrefix(x.tag, t.tag));
          if (exts.length) return exts;
          return [{ tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, tab: t?.config?.tab, view: t?.config?.view } }];
        })
        .filter(x => !!x));
  });

  /**
   * Exts for all global Templates. If no Ext is found a default will be created.
   */
  readonly globalExts = computed((): Ext[] => {
    return uniq(this.globalTemplates()
        .flatMap(t => {
          if (this.exts().find(x => hasPrefix(x.tag, t.tag))) {
            // Already an active ext so ignore global
            return [];
          }
          return [{ tag: t.tag, origin: t.origin, name: t.name, config: { ...t.defaults, tab: t.config?.tab, view: t.config?.view } }];
        })
        .filter(x => !!x));
  });

  /**
   * Templates found in top ands of query or filters.
   */
  readonly activeTemplates = computed((): Template[] => {
    return uniq(this.urlQueryTags()
        .map(tag => this.extTemplates().find(t => hasPrefix(tag, t.tag))!)
        .filter(t => !!t));
  });

  readonly globalTemplates = computed((): Template[] => {
    return this.extTemplates().filter(t => t.config?.global);
  });

  isTemplate(template: string) {
    return hasPrefix(this.viewExt()?.tag, template);
  }

  readonly tags = computed((): boolean => {
    const s = this.route.routeSnapshot()?.firstChild;
    return s?.url[0].path === 'tags';
  });

  readonly settings = computed(() => {
    const s = this.route.routeSnapshot()?.firstChild;
    return s?.routeConfig?.path === 'settings';
  });

  readonly settingsTag = computed(() => {
    if (!this.settings()) return '';
    return this.childTag();
  });

  readonly settingsExt = computed(() => {
    return this.settingsTabs().find(t => t.tag === this.settingsTag()) as Ext;
  });

  readonly inbox = computed(() => {
    const s = this.route.routeSnapshot()?.firstChild;
    return s?.routeConfig?.path === 'inbox';
  });

  readonly inboxTag = computed(() => {
    if (!this.inbox()) return '';
    return this.childTag();
  });

  readonly current = computed((): View | undefined => {
    const s = this.route.routeSnapshot()?.firstChild;
    switch (s?.url[0].path) {
      case 'home': return 'home';
      case 'tags': return 'tags';
      case 'tag':
        if (this.tag() === '@*') return 'all';
        if (this.tag() === '*') return 'local';
        if (isQuery(this.tag())) return 'query';
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

  readonly originFilter = computed(() => {
    return this.filter()?.some(f => f.startsWith('query/@') || f === 'query/*');
  });

  readonly showRemotesCheckbox = computed(() => {
    if (this.originFilter()) return false;
    return ['tags', 'settings/user', 'settings/plugin', 'settings/template', 'settings/ref', 'inbox/ref'].includes(this.current()!);
  });

  readonly type = computed((): Type | undefined => {
    const current = this.current();
    if (!current) return undefined;
    if (current === 'ref/summary') return undefined;
    if (current === 'tags') return 'ext';
    if (current.startsWith('ref/') ||
      current.startsWith('inbox/') ||
      current ==='home' ||
      current ==='all' ||
      current ==='local' ||
      current ==='tag' ||
      current ==='query' ) {
      return 'ref';
    }
    if (current.startsWith('settings/')) {
      return current.substring('settings/'.length) as Type;
    }
    return current as Type;
  });

  readonly forYou = computed(() => {
    return !!this.route.routeSnapshot()?.queryParams['forYou'];
  });

  readonly origin = computed(() => {
    return this.route.routeSnapshot()?.queryParams['origin'];
  });

  readonly depth = computed(() => {
    return this.route.routeSnapshot()?.queryParams['depth'];
  });

  readonly isTextPost = computed(() => {
    return this.url()?.startsWith('comment:');
  });

  readonly alarm = computed((): boolean => {
    return this.account.alarms().includes(this.tag());
  });

  readonly tag = computed((): string => {
    return this.route.routeSnapshot()?.firstChild?.params['tag'] || '';
  });

  readonly childTag = computed((): string => {
    return this.route.routeSnapshot()?.firstChild?.firstChild?.params['tag'] || '';
  });

  /**
   * The main tag associated with this view.
   */
  readonly viewTag = computed((): string => {
    return this.view() || this.activeExts()[0]?.tag || '';
  });

  /**
   * The main Ext associated with this view.
   */
  readonly viewExt = computed(() => {
    if (this.list()) return undefined;
    return this.viewTag() && [...this.activeExts(), ...this.globalExts()].find(x => hasPrefix(x.tag, this.viewTag())) || this.exts()[0];
  });

  readonly homeExt = computed(() => {
    if (this.list()) return this.ext();
    return {
      ...this.ext() || {},
      config: {
        ...this.ext()?.config || {},
        noFloatingSidebar: this.viewExt()?.config?.noFloatingSidebar ?? this.ext()?.config?.noFloatingSidebar,
      },
    };
  });

  readonly template = computed((): string => {
    return this.route.routeSnapshot()?.firstChild?.params['template'] || '';
  });

  readonly localTemplate = computed((): string => {
    return localTag(this.template());
  });

  readonly userTemplate = computed(() => {
    return hasPrefix(this.localTemplate(), 'user');
  });

  readonly noTemplate = computed((): boolean => {
    return this.route.routeSnapshot()?.queryParams['noTemplate'] !== undefined && this.route.routeSnapshot()?.queryParams['noTemplate'] !== 'false';
  });

  readonly home = computed((): boolean => {
    return this.route.routeSnapshot()?.queryParams['home'] !== undefined && this.route.routeSnapshot()?.queryParams['home'] !== 'false';
  });

  readonly query = computed(() => {
    return isQuery(this.tag()) ? this.tag() : '';
  });

  readonly urlQueryTags = computed(() => {
    return getQueryTags(this.tag(), this.urlFilters());
  });

  readonly queryTags = computed(() => {
    return getQueryTags(this.tag(), this.filter());
  });

  readonly noQuery = computed(() => {
    return isQuery(this.tag()) ? '' : this.tag();
  });

  readonly localTag = computed(() => {
    return localTag(this.tag());
  });

  readonly name = computed(() => {
    if (this.tag() === '@*') return $localize`All`;
    if (this.tag() === '*') return $localize`Local`;
    if (isQuery(this.tag())) return $localize`Query`;
    return this.exts()[0]?.name || this.viewExt()?.name || (this.viewExt()?.tag || this.tag()).substring(this.tag().lastIndexOf('/') + 1);
  });

  readonly cols = computed(() => {
    return parseInt(this.route.routeSnapshot()?.queryParams['cols'] || this.viewExt()?.config?.defaultCols || 0);
  });

  readonly viewExtSort = computed(() => {
    if (this.current() === 'home') return this.ext()?.config?.defaultSort;
    if (this.current() !== 'tag') return undefined;
    return this.viewExt()?.config?.defaultSort;
  });

  readonly viewExtFilter = computed(() => {
    if (this.current() === 'home') return this.ext()?.config?.defaultFilter;
    if (this.current() !== 'tag') return undefined;
    return this.viewExt()?.config?.defaultFilter;
  });

  readonly sort = computed(() => {
    const sort = this.route.routeSnapshot()?.queryParams['sort'];
    if (!sort) {
      if (this.search() && this.defaultSearchSort()) return this.defaultSearchSort();
      return this.viewExtSort() || this.defaultSort() || [];
    }
    if (!Array.isArray(sort)) return [sort]
    return sort;
  }, { equal: isEqual });

  readonly isSorted = computed(() => {
    if (this.sort().length > 1) return true;
    if (this.search() && this.defaultSearchSort()) return !isEqual(this.sort(), this.defaultSearchSort());
    return !isEqual(this.sort(), this.defaultSort());
  });

  readonly isVoteSorted = computed(() => {
    return this.sort()[0]?.startsWith('plugins->plugin/user/vote');
  });

  readonly urlFilters = computed((): UrlFilter[] => {
    const filter = this.route.routeSnapshot()?.queryParams['filter'];
    if (!filter) return [];
    if (!Array.isArray(filter)) return [filter];
    return filter;
  }, { equal: isEqual });

  readonly filter = computed((): UrlFilter[] => {
    return this.urlFilters().length ? this.urlFilters() : this.viewExtFilter() || [];
  }, { equal: isEqual });

  readonly queryFilters = computed((): string[] => {
    return this.filter()
      .filter(f => f.startsWith('query/'))
      .map(f => f.substring('query/'.length));
  }, { equal: isEqual });

  readonly search = computed(() => {
    return this.route.routeSnapshot()?.queryParams['search'];
  });

  readonly isSearch = computed(() => {
    return !!this.search();
  });

  readonly pageNumber = computed(() => {
    return this.route.routeSnapshot()?.queryParams['pageNumber'] || this.defaultPageNumber();
  });

  readonly pageSize = computed(() => {
    if (this.route.routeSnapshot()?.queryParams['pageSize']) {
      return parseInt(this.route.routeSnapshot()?.queryParams['pageSize']);
    }
    if (this.isTemplate('kanban')) return this.account.config().kanbanLoadSize || this.defaultKanbanLoadSize;
    return parseInt(this.route.routeSnapshot()?.queryParams['pageSize'] ?? (this.isTemplate('blog') ? this.defaultBlogPageSize : this.defaultPageSize));
  });

  readonly published = computed(() => {
    return this.route.routeSnapshot()?.queryParams['published'];
  });

  readonly view = computed((): string => {
    return this.route.routeSnapshot()?.queryParams['view'];
  });

  readonly noView = computed(() => {
    return !this.view();
  });

  readonly list = computed(() => {
    return this.view() === 'list';
  });

  readonly graph = computed(() => {
    return this.view() === 'graph';
  });

  readonly showRemotes = computed(() => {
    if (!this.showRemotesCheckbox()) return true;
    return this.route.routeSnapshot()?.queryParams['showRemotes'] !== undefined && this.route.routeSnapshot()?.queryParams['showRemotes'] !== 'false';
  });

  readonly repost = computed(() => {
    return this.ref()?.sources?.[0] && hasTag('plugin/repost', this.ref());
  });
}
