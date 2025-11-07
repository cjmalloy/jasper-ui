import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Schema, validate } from 'jtd';
import { identity, isEqual, reduce, uniq } from 'lodash-es';
import { autorun, runInAction } from 'mobx';
import { catchError, concat, forkJoin, map, Observable, of, retry, switchMap, throwError, toArray } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { bundleSize, clear, condition, Config, EditorButton, Mod } from '../model/tag';
import { Template } from '../model/template';
import { User } from '../model/user';
import { aiMod } from '../mods/ai/ai';
import { dalleMod } from '../mods/ai/dalle';
import { naviMod } from '../mods/ai/navi';
import { summaryMod } from '../mods/ai/summary';
import { translateMod } from '../mods/ai/translate';
import { blogMod } from '../mods/blog';
import { chatMod } from '../mods/chat';
import { commentMod } from '../mods/comment';
import { deleteMod, tagDeleteNotice } from '../mods/delete';
import { htmlMod, latexMod } from '../mods/editor';
import { experimentsMod } from '../mods/experiments';
import { backgammonMod } from '../mods/games/backgammon';
import { chessMod } from '../mods/games/chess';
import { homeMod } from '../mods/home';
import { lensMod } from '../mods/lens';
import { mailboxMod } from '../mods/mailbox';
import { audioMod } from '../mods/media/audio';
import { codeMod } from '../mods/media/code';
import { embedMod } from '../mods/media/embed';
import { fileMod } from '../mods/media/file';
import { imageMod } from '../mods/media/image';
import { pdfMod } from '../mods/media/pdf';
import { playlistMod } from '../mods/media/playlist';
import { tableMod } from '../mods/media/table';
import { videoMod } from '../mods/media/video';
import { modMod } from '../mods/mod';
import { modlistMod } from '../mods/modlist';
import { folderMod } from '../mods/org/folder';
import { graphMod } from '../mods/org/graph';
import { hideMod } from '../mods/org/hide';
import { kanbanMod } from '../mods/org/kanban';
import { notesMod } from '../mods/org/notes';
import { personMod } from '../mods/org/person';
import { queueMod } from '../mods/org/queue';
import { readMod } from '../mods/org/read';
import { saveMod } from '../mods/org/save';
import { todoMod } from '../mods/org/todo';
import { DEFAULT_WIKI_PREFIX, wikiMod } from '../mods/org/wiki';
import { repostMod } from '../mods/repost';
import { rootMod } from '../mods/root';
import { emailMod } from '../mods/sync/email';
import { feedMod } from '../mods/sync/feed';
import { remoteOriginMod } from '../mods/sync/origin';
import { scrapeMod } from '../mods/sync/scrape';
import { banlistMod } from '../mods/system/banlist';
import { cacheMod } from '../mods/system/cache';
import { debugMod } from '../mods/system/debug';
import { errorMod } from '../mods/system/error';
import { fullscreenMod } from '../mods/system/fullscreen';
import { gdprMod } from '../mods/system/gdpr';
import { oembedMod } from '../mods/system/oembed';
import { pipMod } from '../mods/system/pip';
import { scriptMod } from '../mods/system/script';
import { seamlessMod } from '../mods/system/seamless';
import { secretMod } from '../mods/system/secret';
import { snippetMod } from '../mods/system/snippet';
import { systemMod } from '../mods/system/system';
import { themesMod } from '../mods/system/theme';
import { threadMod } from '../mods/thread';
import { thumbnailMod } from '../mods/thumbnail';
import { archiveMod } from '../mods/tools/archive';
import { htmlToMarkdownMod } from '../mods/tools/htmlToMarkdown';
import { ninjaTriangleMod } from '../mods/tools/ninga-triangle';
import { pollMod } from '../mods/tools/poll';
import { qrMod } from '../mods/tools/qr';
import { thanksMod } from '../mods/tools/thanks';
import { userMod } from '../mods/user';
import { voteMod } from '../mods/vote';
import { ytdlpMod } from '../mods/ytdlp';
import { progress } from '../store/bus';
import { Store } from '../store/store';
import { modId } from '../util/format';
import { getExtension, getHost, getScheme } from '../util/http';
import { memo, MemoCache } from '../util/memo';
import { addHierarchicalTags, directChild, hasPrefix, hasTag, tagIntersection, test } from '../util/tag';
import { ExtService } from './api/ext.service';
import { PluginService } from './api/plugin.service';
import { RefService } from './api/ref.service';
import { TemplateService } from './api/template.service';
import { UserService } from './api/user.service';
import { AuthzService } from './authz.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {

  status = {
    plugins: <Record<string, Plugin>> {},
    disabledPlugins: <Record<string, Plugin>> {},
    templates: <Record<string, Template>> {},
    disabledTemplates: <Record<string, Template>> {},
  };

  mods: Mod[] = [
    debugMod,
    rootMod,
    userMod,
    folderMod,
    homeMod,
    kanbanMod,
    blogMod,
    chatMod,
    mailboxMod,
    hideMod,
    saveMod,
    readMod,

    // Themes
    themesMod,

    // Configs
    experimentsMod,
    wikiMod,
    graphMod,
    modlistMod,
    banlistMod,
    snippetMod,
    htmlToMarkdownMod,
    thanksMod,
    gdprMod,

    // Plugins
    modMod,
    oembedMod,
    scrapeMod,
    cacheMod,
    systemMod,
    secretMod,
    errorMod,
    remoteOriginMod,
    scriptMod,
    feedMod,
    deleteMod,
    mailboxMod,
    modlistMod,
    commentMod,
    threadMod,
    notesMod,
    emailMod,
    fullscreenMod,
    seamlessMod,
    thumbnailMod,
    tableMod,
    aiMod,
    naviMod,
    dalleMod,
    summaryMod,
    translateMod,
    pdfMod,
    archiveMod,
    latexMod,
    codeMod,
    htmlMod,
    personMod,
    repostMod,
    queueMod,
    qrMod,
    embedMod,
    audioMod,
    videoMod,
    ytdlpMod,
    voteMod,
    imageMod,
    lensMod,
    pipMod,
    chessMod,
    backgammonMod,
    pollMod,
    todoMod,
    ninjaTriangleMod,
    playlistMod,
    fileMod,
  ];

  def = {
    plugins: <Record<string, Plugin>> Object.fromEntries(this.mods.flatMap(mod => mod.plugin || []).map(p => [p.tag, p])),
    templates: <Record<string, Template>> Object.fromEntries(this.mods.flatMap(mod => mod.template || []).map(t => [t.tag, t])),
  };

  _cache = new Map<string, any>();
  private firstRun = false;

  constructor(
    private config: ConfigService,
    private auth: AuthzService,
    private refs: RefService,
    private exts: ExtService,
    private users: UserService,
    private plugins: PluginService,
    private templates: TemplateService,
    private store: Store,
  ) {
    autorun(() => {
      const mod = this.store.eventBus.ref?.plugins?.['plugin/mod'];
      if (this.store.eventBus.event === 'install') {
        store.eventBus.clearProgress(bundleSize(mod));
        this.install$(this.store.eventBus.ref?.title || '', mod, (msg, p = 0) => store.eventBus.progress(msg, p))
          .subscribe(mod => {
            this.pluginToStatus(mod.plugin || []);
            this.templateToStatus(mod.template || []);
          });
      }
    });
  }

  get init$() {
    this._cache.clear();
    MemoCache.clear(this);
    runInAction(() => this.store.view.updates = false);
    this.status.plugins = {};
    this.status.disabledPlugins = {};
    this.status.templates = {};
    this.status.disabledTemplates = {};
    return forkJoin([this.loadPlugins$(), this.loadTemplates$()]).pipe(
      switchMap(() => this.firstRun$),
      tap(() => this.updates),
      catchError(() => of(null)),
    );
  }

  get updates() {
    for (const p of Object.values(this.status.plugins)) if (p?.config?.needsUpdate) return this.store.view.updateNotify();
    for (const t of Object.values(this.status.templates)) if (t?.config?.needsUpdate) return this.store.view.updateNotify();
    return false;
  }

  get firstRun$(): Observable<any> {
    if (this.firstRun) return of(null);
    this.firstRun = true;
    if (!this.store.account.admin || this.store.account.ext) return of(null);
    if (Object.values(this.status.plugins).filter(p => !!p).length > 0) return of(null);
    if (Object.values(this.status.templates).filter(t => !!t && !t.tag.startsWith('_config/')).length > 0) return of(null);

    const installs = this.defaultPlugins.map(p => this.plugins.create({
      ...p,
      origin: this.store.account.origin,
    }).pipe(
      catchError(err => {
        if (err.status === 409) {
          // Ignore already exists
          console.warn('Ignoring 409 ', err);
          return of(null);
        }
        return throwError(() => err);
      })
    ));
    installs.push(...this.defaultTemplates.map(t => this.templates.create({
      ...t,
      origin: this.store.account.origin,
    }).pipe(
      catchError(err => {
        if (err.status === 409) {
          // Ignore already exists
          console.warn('Ignoring 409 ', err);
          return of(null);
        }
        return throwError(() => err);
      })
    )));
    return this.exts.create({
      tag: this.store.account.localTag,
      origin: this.store.account.origin,
    }).pipe(
      tap(() => this.store.eventBus.fire('*:defaults')),
      switchMap(() => concat(...installs)),
      switchMap(() => this.init$)
    );
  }

  get localOriginQuery() {
    return this.store.account.origin || '*';
  }

  private loadPlugins$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxPlugins) {
      console.error(`Too many plugins to load, only loaded ${alreadyLoaded}. Increase maxPlugins to load more.`)
      return of(null);
    }
    return this.plugins.page({query: this.localOriginQuery, page, size: this.config.fetchBatch}).pipe(
      retry(10),
      tap(batch => this.pluginToStatus(batch.content)),
      switchMap(batch => page + 1 < batch.page.totalPages ? this.loadPlugins$(page + 1) : of(null)),
    );
  }

  private loadTemplates$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxTemplates) {
      console.error(`Too many templates to load, only loaded ${alreadyLoaded}. Increase maxTemplates to load more.`)
      return of(null);
    }
    return this.templates.page({query: this.localOriginQuery + ':!_config', page, size: this.config.fetchBatch}).pipe(
      retry(10),
      tap(batch => this.templateToStatus(batch.content)),
      switchMap(batch => page + 1 < batch.page.totalPages ? this.loadTemplates$(page + 1) : of(null)),
    );
  }

  private pluginToStatus(list: Plugin[]) {
    for (const p of list) {
      if (p.config?.disabled) {
        this.status.disabledPlugins[p.tag] = p;
      } else {
        this.status.plugins[p.tag] = p;
        this.def.plugins[p.tag] ||= clear(p);
      }
      p.config ||= {};
      p.config.needsUpdate ||= this.needsUpdate(this.def.plugins[p.tag], p);
      if (p.config.needsUpdate) {
        console.log(p.tag + ' needs update');
      }
    }
  }

  private templateToStatus(list: Template[]) {
    for (const t of list) {
      if (t.config?.disabled) {
        this.status.disabledTemplates[t.tag] = t;
      } else {
        this.status.templates[t.tag] = t;
        this.def.templates[t.tag] ||= t;
      }
      t.config ||= {};
      t.config.needsUpdate ||= this.needsUpdate(this.def.templates[t.tag], t);
      if (t.config.needsUpdate) {
        console.log((t.tag || 'Root template') + ' needs update');
      }
    }
  }

  private get _extFallback() {
    return (x: Ext) => {
      if (!x.tag || x.modifiedString) return x;
      x = {...x};
      const tmpl = this.getTemplate(x.tag);
      let plugin = this.getPlugin(x.tag);
      x.name ||= plugin?.name || tmpl?.name;
      return x;
    };
  }

  get extFallback() {
    return map(this._extFallback);
  }

  get extFallbacks() {
    return map((xs: Ext[]) => xs.map(this._extFallback));
  }

  get authorFallback() {
    return map((xs: Ext[]) => xs.map(x => {
      if (!x.tag || x.modifiedString) return x;
      x = {...x};
      const tmpl = this.getTemplate(x.tag);
      let plugin = this.getPlugin(x.tag);
      if (plugin?.config?.signature) {
        plugin = this.getPlugin(plugin.config.signature) || plugin;
        x.tag = plugin?.tag || x.tag;
        x.name ||= plugin?.name;
      } else if (x.tag.startsWith('+plugin/')) {
        x.tag = '';
      }
      x.name ||= tmpl?.name;
      return x;
    }));
  }

  get recipientFallback() {
    return map((xs: Ext[]) => xs.map(x => {
      if (!x.tag || x.modifiedString) return x;
      x = {...x};
      const inbox = (hasPrefix(x.tag, 'plugin') ? '' : 'plugin/inbox/') + x.tag;
      const tmpl = this.getTemplate(inbox);
      let plugin = this.getPlugin(inbox);
      if (plugin?.config?.signature) {
        plugin = this.getPlugin(plugin.config.signature) || plugin;
        x.tag = plugin?.tag || x.tag;
        x.name ||= plugin?.name;
      }
      x.name ||= tmpl?.name;
      return x;
    }));
  }

  configProperty(...names: string[]): [Plugin | Template] {
    const key = names.join(':');
    if (!this._cache.has(key)) {
      this._cache.set(key, [
        ...Object.values(this.status.plugins),
        ...Object.values(this.status.templates)
      ].filter(p => {
        for (const n of names) {
          if (n.startsWith('!')) {
            if (p?.config?.[n.substring(1)]) return false;
          } else {
            if (!p?.config?.[n]) return false;
          }
        }
        return true;
      }));
    }
    return this._cache.get(key)!;
  }

  pluginConfigProperty(...names: string[]): Plugin[] {
    const key = names.join(':');
    if (!this._cache.has(key)) {
      this._cache.set(key, Object.values(this.status.plugins).filter(p => {
        for (const n of names) {
          if (n.startsWith('!')) {
            if (p?.config?.[n.substring(1)]) return false;
          } else {
            if (!p?.config?.[n]) return false;
          }
        }
        return true;
      }));
    }
    return this._cache.get(key)!;
  }

  templateConfigProperty(...names: string[]): Template[] {
    const key = 't!'+names.join(':');
    if (!this._cache.has(key)) {
      this._cache.set(key, Object.values(this.status.templates).filter(p => {
        for (const n of names) {
          if (n.startsWith('!')) {
            if (p?.config?.[n.substring(1)]) return false;
          } else {
            if (!p?.config?.[n]) return false;
          }
        }
        return true;
      }));
    }
    return this._cache.get(key)!;
  }

  get pip() {
    // @ts-ignore
    if (!documentPictureInPicture) return false;
    return this.getPlugin('plugin/pip');
  }

  get defaultPlugins() {
    return Object.values(this.def.plugins).filter(p => p?.config?.default) as Plugin[];
  }

  get defaultTemplates() {
    return Object.values(this.def.templates).filter(t => t?.config?.default) as Template[];
  }

  get readAccess() {
    return this.configProperty('readAccess')
      .flatMap(p => p.config!.readAccess!);
  }

  get writeAccess() {
    return this.templateConfigProperty('writeAccess')
      .flatMap(p => p.config!.writeAccess!);
  }

  get reply() {
    return this.configProperty('reply');
  }

  get inbox() {
    return this.pluginConfigProperty('inbox');
  }

  get submit() {
    return this.pluginConfigProperty('submit', '!genId', '!settings');
  }

  get add() {
    return this.pluginConfigProperty('add');
  }

  get submitGenId() {
    return this.pluginConfigProperty('submit', 'genId', '!settings');
  }

  get submitText() {
    return this.pluginConfigProperty('submitText');
  }

  get submitDm() {
    return this.pluginConfigProperty('submitDm');
  }

  get settings() {
    return this.pluginConfigProperty('settings');
  }

  get submitSettings() {
    return this.pluginConfigProperty('submit', 'settings', '!genId');
  }

  get extensions() {
    return this.pluginConfigProperty('extensions');
  }

  get prefix() {
    return this.pluginConfigProperty('prefix');
  }

  get hosts() {
    return this.pluginConfigProperty('hosts');
  }

  get schemes() {
    return this.pluginConfigProperty('schemes');
  }

  get tmplSubmit() {
    return this.templateConfigProperty('submit');
  }

  get view() {
    return this.templateConfigProperty('view');
  }

  get local() {
    return this.templateConfigProperty('local');
  }

  get editorButtons() {
    return this.configProperty('editorButtons');
  }

  get responseButton() {
    return this.pluginConfigProperty('responseButton');
  }

  get uis() {
    return this.pluginConfigProperty('ui');
  }

  get infoUis() {
    return this.pluginConfigProperty('infoUi');
  }

  get forms() {
    return this.addPluginParents(uniq([
      ...this.pluginConfigProperty('form'),
      ...this.pluginConfigProperty('advancedForm')
    ]));
  }

  get embeddable(): string[] {
    if (!this._cache.has('embeddable')) {
      this._cache.set('embeddable', Object.values(this.status.plugins).filter(p => {
        if (!p) return false;
        if (p?.config?.embeddable) return true;
        if (p?.config?.editingViewer) return true;
        if (p?.config?.ui) return true;
        return false;
      }).map(p => p!.tag));
    }
    return this._cache.get('embeddable')!;
  }

  get editor() {
    return this.pluginConfigProperty('editor');
  }

  get editingViewer() {
    return this.pluginConfigProperty('editingViewer');
  }

  get icons() {
    return this.configProperty('icons');
  }

  get bulkForm() {
    return this.pluginConfigProperty('bulkForm');
  }

  get actions() {
    return this.configProperty('actions');
  }

  get advancedActions() {
    return this.configProperty('advancedActions');
  }

  get themes() {
    return this.configProperty('themes');
  }

  get filters() {
    return this.configProperty('filters')
      .flatMap(p => p.config?.filters!);
  }

  get refSorts() {
    return this.pluginConfigProperty('sorts')
      .flatMap(p => p.config?.sorts!);
  }

  get tagSorts() {
    return this.templateConfigProperty('sorts')
      .flatMap(p => p.config?.sorts!);
  }

  addPluginParents(cs: Plugin[]) {
    return uniq(cs.flatMap(c =>
      addHierarchicalTags(c.tag)
        .map(tag => this.getPlugin(tag))
        .filter(identity) as Plugin[]));
  }

  getEmbeds(ref?: Ref | null) {
    if (!ref) return [];
    const tags = ref.tags || [];
    return tagIntersection([
      'plugin',
      ...tags,
      ...this.getPluginsForUrl(ref.url).map(p => p.tag),
      ...this.getPluginsForCache(ref),
      ...(ref.alternateUrls || []).flatMap(url => this.getPluginsForUrl(url).map(p => p.tag)),
    ], this.embeddable) as string[];
  }

  getPluginsForUrl(url: string) {
    return uniq([...this.getPluginsForHost(url), ...this.getPluginsForScheme(url), ...this.getPluginsForPrefix(url), ...this.getPluginsForExtension(url)]);
  }

  getPluginsForCache(ref: Ref): string[] {
    const mimeType = ref.plugins?.['_plugin/cache']?.mimeType as string | undefined;
    if (!mimeType) return [];
    if (mimeType.startsWith('image/')) return ['plugin/image'];
    if (mimeType.startsWith('video/')) return ['plugin/video'];
    return [];
  }

  getPluginsForHost(url: string) {
    const host = getHost(url);
    return this.hosts.filter(p => p.config!.hosts!.includes(host!))
  }

  getPluginsForScheme(url: string) {
    const scheme = getScheme(url);
    return this.schemes.filter(p => p.config!.schemes!.includes(scheme!))
  }

  getPluginsForPrefix(url: string) {
    return this.prefix.filter(p => p.config!.prefix!.find(prefix => url.startsWith(prefix)));
  }

  getPluginsForExtension(url: string) {
    const type = getExtension(url) || '';
    return this.extensions.filter(p => p.config!.extensions!.includes(type))
  }

  getActions(tags?: string[], config?: any) {
    const match = ['plugin', ...(tags || [])];
    return this.actions
      .flatMap(p => p.config!.actions!.filter(a => {
        if (a.condition && !condition(a.condition, config?.[p.tag])) return false;
        if (a.global) return true;
        return hasTag(p.tag, match);
      }).map(addParent(p)))
      .filter(a => !a.role || this.auth.hasRole(a.role));
  }

  getAdvancedActions(tags?: string[], config?: any) {
    const match = ['plugin', ...(tags || [])];
    return this.advancedActions
      .flatMap(p => p.config!.advancedActions!.filter(a => {
        if (a.condition && !condition(a.condition, config?.[p.tag])) return false;
        if (a.global) return true;
        return hasTag(p.tag, match);
      }).map(addParent(p)))
      .filter(a => !a.role || this.auth.hasRole(a.role));
  }

  getIcons(tags?: string[], config?: any, scheme?: string) {
    const match = ['plugin', ...(tags || [])];
    return this.icons
      .flatMap(p => p.config!.icons!.filter(i => {
        if (i.condition && !condition(i.condition, config?.[p.tag])) return false;
        if (i.global) return true;
        if (i.scheme && i.scheme === scheme) return true;
        if (i.tag && !hasTag(i.tag, match)) return false;
        return hasTag(p.tag, match);
      }).map(addParent(p))
        .map(i => {
          if (!i.tag && !i.response && !i.anyResponse && !i.noResponse && !i.scheme) i.tag ||= p.tag;
          if (!i.tag || i.tag === p.tag) i.title ||= p.name;
          i.title ||= i.tag;
          return i;
        }))
      .filter(i => !i.role || this.auth.hasRole(i.role));
  }

  getEditorButtons(tags?: string[], scheme?: string): EditorButton[] {
    const match = ['plugin', ...(tags || [])];
    return this.editorButtons
      .flatMap(config => config.config!.editorButtons!.filter(b => {
        if (b.global) return true;
        if (b.scheme && b.scheme === scheme) return true;
        return test(b.query || config.tag, match);
      }).map(addParent(config))
        .map(b => {
          if (b.ribbon || !b.event) b.toggle ||= config.tag;
          return b;
        }));
  }

  getTemplateView(tag: string) {
    return this.view
      .filter(t => hasPrefix(tag, t.tag));
  }

  @memo
  getPlugin(tag: string) {
    return Object.values(this.status.plugins).find(p => p?.tag === tag);
  }

  @memo
  searchPlugins(text: string) {
    text = text.toLowerCase();
    return Object.values(this.status.plugins).filter(p => p?.tag.includes(text) || p?.name?.toLowerCase()?.includes(text));
  }

  @memo
  getParentPlugins(tag: string) {
    return this.getPlugins([tag]);
  }

  getPlugins(tags: string[] | undefined) {
    if (!tags) return [];
    return Object.values(this.status.plugins).filter(p => hasTag(p?.tag, tags)) as Plugin[];
  }

  getPluginUi(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.uis.filter(p => hasTag(p.tag, match));
  }

  getPluginInfoUis(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.infoUis.filter(p => hasTag(p.tag, match));
  }

  getPluginForms(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.forms.filter(p => hasTag(p.tag, match));
  }

  @memo
  getPluginSubForms(parent: string) {
    return this.forms.filter(p => p.config?.submitChild && directChild(p.tag, parent));
  }

  getTemplate(tag: string) {
    if (this.status.templates[tag]) return this.status.templates[tag];
    return Object.values(this.status.templates).find(t => {
      if (t?.tag === tag.replace('+', '')) return true;
      return t?.tag === tag.replace('_', '');
    });
  }

  @memo
  searchTemplates(text: string) {
    text = text.toLowerCase();
    return Object.values(this.status.templates).filter(p => p?.tag.includes(text) || p?.name?.toLowerCase()?.includes(text));
  }

  defaultConfig(tag: string) {
    return reduce(this.getTemplates(tag).map(t => t.defaults || {}), (prev, curr) => {
      return {...prev, ...curr};
    }, {});
  }

  getPluginSettings(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.settings.filter(p => hasTag(p.tag, match));
  }

  @memo
  getTemplates(tag = ''): Template[] {
    const template = this.getTemplate(tag);
    const parent = tag ? tag.substring(0, tag.lastIndexOf('/')) : null;
    if (template) {
      if (!tag) return [template];
      return [...this.getTemplates(parent!), template]
    } else if (tag) {
      return this.getTemplates(parent!);
    }
    return [];
  }

  getTemplateUi(tag = ''): Template[] {
    const template = this.getTemplate(tag);
    const parent = tag ? tag.substring(0, tag.lastIndexOf('/')) : null;
    if (template?.config?.ui) {
      if (!tag || template.config?.overrideUi) return [template];
      return [...this.getTemplateUi(parent!), template]
    } else if (tag) {
      return this.getTemplateUi(parent!);
    }
    return [];
  }

  getTemplateForm(tag = ''): FormlyFieldConfig[] {
    const template = this.getTemplate(tag);
    const form = template?.config?.form;
    const parent = tag ? tag.substring(0, tag.lastIndexOf('/')) : null;
    if (form) {
      if (!tag || template!.config?.overrideForm) return form;
      return [...form, ...this.getTemplateForm(parent!)]
    } else if (tag) {
      return this.getTemplateForm(parent!);
    }
    return [];
  }

  getTemplateAdvancedForm(tag = ''): FormlyFieldConfig[] {
    const template = this.getTemplate(tag);
    const form = template?.config?.advancedForm;
    const parent = tag ? tag.substring(0, tag.lastIndexOf('/')) : null;
    if (form) {
      if (!tag || template!.config?.overrideForm) return form;
      return [...form, ...this.getTemplateAdvancedForm(parent!)]
    } else if (tag) {
      return this.getTemplateAdvancedForm(parent!);
    }
    return [];
  }

  getDefaults(tag = ''): any {
    const template = this.getTemplate(tag);
    const defaults = template?.defaults;
    const parent = tag ? tag.substring(0, tag.lastIndexOf('/')) : null;
    if (defaults) {
      if (!tag || template!.config?.overrideForm) return defaults;
      return {
        ...this.getDefaults(parent!),
        ...defaults
      };
    } else if (tag) {
      return this.getDefaults(parent!);
    }
    return undefined;
  }

  stripInvalid(tag: string, data: any): any {
    const plugin = this.getPlugin(tag);
    const schema = plugin?.schema;
    const defaults = plugin?.defaults || {};
    if (this.isValid(schema, data)) return data;
    // Sanity test, if defaults don't validate just bail
    if (!this.isValid(schema, defaults)) return undefined;
    const result = { ...defaults };
    for (const [key, value] of Object.entries(data)) {
      if (this.isValid(schema, { ...result, [key]: value })) {
        result[key] = value;
      }
    }
    return result;
  }

  isValid(schema: Schema | undefined, data: any) {
    if (!schema) return false;
    return !validate(schema, data,{ maxErrors: 1, maxDepth: 0 }).length;
  }

  isWikiExternal() {
    return !!this.getTemplate('config/wiki')?.config?.external;
  }

  getWikiPrefix() {
    return this.getTemplate('config/wiki')?.config?.prefix || DEFAULT_WIKI_PREFIX;
  }

  getMod(mod: String) {
    const bundle = this.mods.find(m =>
      m.plugin?.find(p => modId(p) === mod) ||
      m.template?.find(t => modId(t) === mod)
    );
    if (bundle) return bundle;
    const modPlugins = Object.values(this.status.plugins).filter(p => modId(p) === mod).map(p => p.tag);
    const modTemplates = Object.values(this.status.templates).filter(p => modId(p) === mod).map(t => t.tag);
    return this.mods.find(m =>
      m.plugin?.find(p => modPlugins.includes(p.tag)) ||
      m.template?.find(t => modTemplates.includes(t.tag))
    );
  }

  installRef$(def: Ref, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Installing ${def.title || def.url} ref...`)),
      switchMap(() => this.refs.create({
        ...def,
        origin: this.store.account.origin,
        url: def.url || ('comment:' + uuid()),
      })),
      catchError(err => {
        if (err.status === 409) {
          _('\u00A0'.repeat(4) + $localize`Ref ${def.title || def.url} already exists...`);
          return of(null);
        }
        return throwError(() => err);
      }),
      tap(() => _('', 1)),
    );
  }

  installExt$(def: Ext, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Installing ${def.name || def.tag} ext...`)),
      switchMap(() => this.exts.create({ ...def, origin: this.store.account.origin })),
      catchError(err => {
        if (err.status === 409) {
          _('\u00A0'.repeat(4) + $localize`Ext ${def.name || def.tag} already exists...`);
          return of(null);
        }
        return throwError(() => err);
      }),
      tap(() => _('', 1)),
    );
  }

  installUser$(def: User, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Installing ${def.name || def.tag} user...`)),
      switchMap(() => this.users.create({ ...def, origin: this.store.account.origin })),
      catchError(err => {
        if (err.status === 409) {
          _('\u00A0'.repeat(4) + $localize`User ${def.name || def.tag} already exists...`);
          return of(null);
        }
        return throwError(() => err);
      }),
      tap(() => _('', 1)),
    );
  }

  installPlugin$(def: Plugin, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Installing ${def.name || def.tag} plugin...`)),
      switchMap(() => this.plugins.create({ ...def, origin: this.store.account.origin })),
      catchError(err => {
        if (err.status === 409) {
          _('\u00A0'.repeat(4) + $localize`Plugin ${def.name || def.tag} already exists...`);
          return of(null);
        }
        return throwError(() => err);
      }),
      tap(() => _('', 1)),
    );
  }

  deletePlugin$(p: Plugin, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Deleting ${p.name || p.tag} plugin...`)),
      switchMap(() => this.plugins.delete(p.tag + this.store.account.origin)),
      switchMap(() => this.getPlugin('plugin/delete') ? this.plugins.create(tagDeleteNotice(p)) : of(null)),
      tap(() => _('', 1)),
    );
  }

  installTemplate$(def: Template, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Installing ${def.name || def.tag} template...`)),
      switchMap(() => this.templates.create({ ...def, origin: this.store.account.origin })),
      catchError(err => {
        if (err.status === 409) {
          _('\u00A0'.repeat(4) + $localize`Template ${def.name || def.tag} already exists...`);
          return of(null);
        }
        return throwError(() => err);
      }),
      tap(() => _('', 1)),
    );
  }

  deleteTemplate$(t: Template, _: progress) {
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Deleting ${t.name || t.tag} template...`)),
      switchMap(() => this.templates.delete(t.tag + this.store.account.origin)),
      switchMap(() => this.getPlugin('plugin/delete') ? this.templates.create(tagDeleteNotice(t)) : of(null)),
      tap(() => _('', 1)),
    );
  }

  install$(mod: string, bundle: Mod, _: progress): Observable<any> {
    if (!bundle) return of(null);
    return concat(...[
      of(null).pipe(tap(() => _($localize`Installing ${mod} mod...`))),
      ...(bundle.ref || []).map(p => this.installRef$(p, _)),
      ...(bundle.ext || []).map(p => this.installExt$(p, _)),
      ...(bundle.user || []).map(p => this.installUser$(p, _)),
      ...(bundle.plugin || []).map(p => this.installPlugin$(p, _)),
      ...(bundle.template || []).map(t => this.installTemplate$(t, _)),
    ]).pipe(toArray());
  }

  installMod$(mod: string, _: progress): Observable<any> {
    return this.install$(mod, this.getMod(mod)!, _);
  }

  update$(mod: string, bundle: Mod, _: progress): Observable<any> {
    if (!bundle) return of(null);
    return concat(...[
      of(null).pipe(tap(() => _($localize`Installing ${mod} mod...`))),
      ...(bundle.plugin || []).map(p => this.updatePlugin$(p, _)),
      ...(bundle.template || []).map(t => this.updateTemplate$(t, _)),
    ]).pipe(toArray());
  }

  updateMod$(mod: string, _: progress): Observable<any> {
    return this.update$(mod, this.getMod(mod)!, _);
  }

  deleteMod$(mod: string, _: progress): Observable<any> {
    return concat(...[
      of(null).pipe(tap(() => _($localize`Deleting ${mod} mod...`))),
      ...Object.values(this.status.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.deletePlugin$(p!, _)),
      ...Object.values(this.status.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.deleteTemplate$(t!, _)),
    ]).pipe(toArray());
  }

  updatePlugin$(def: Plugin, _: progress) {
    const status = this.status.plugins[def.tag];
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Updating ${def.name || def.tag} plugin...`)),
      switchMap(() => this.plugins.update({
        ...def,
        defaults: {
          ...def.defaults || {},
          ...status?.defaults || {},
        },
        origin: this.store.account.origin,
        modifiedString: status?.modifiedString,
      })),
      tap(() => _('', 1)),
    );
  }

  updateTemplate$(def: Template, _: progress) {
    const status = this.status.templates[def.tag];
    return of(null).pipe(
      tap(() => _('\u00A0'.repeat(4) + $localize`Updating ${def.name || def.tag} template...`)),
      switchMap(() => this.templates.update({
        ...def,
        defaults: {
          ...def.defaults || {},
          ...status?.defaults || {},
        },
        origin: this.store.account.origin,
        modifiedString: status?.modifiedString,
      })),
      tap(() => _('', 1)),
    );
  }

  needsUpdate(def: Config, status: Config) {
    if (!this.store.account.admin) return false;
    if (def.config?.noUpdate || status.config?.noUpdate) return false;
    if (def.config?.version != status.config?.version) {
      if (def.config?.version && status.config?.version) return def.config.version > status.config.version;
    }
    return !isEqual(clear(def), clear(status));
  }
}

function addParent(c: Config) {
  return (a: any) => {
    a._parent = c;
    return a;
  };
}
