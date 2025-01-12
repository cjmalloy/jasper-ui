import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Schema, validate } from 'jtd';
import { identity, isEqual, reduce, uniq } from 'lodash-es';
import { autorun, runInAction } from 'mobx';
import { catchError, concat, forkJoin, map, Observable, of, switchMap, throwError, toArray } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { bundleSize, clear, condition, Config, EditorButton, Mod } from '../model/tag';
import { Template } from '../model/template';
import { User } from '../model/user';
import { aiMod } from '../mods/ai';
import { archiveMod } from '../mods/archive';
import { audioMod } from '../mods/audio';
import { backgammonMod } from '../mods/backgammon';
import { banlistMod } from '../mods/banlist';
import { blogMod } from '../mods/blog';
import { cacheMod } from '../mods/cache';
import { chatMod } from '../mods/chat';
import { chessMod } from '../mods/chess';
import { codeMod } from '../mods/code';
import { commentMod } from '../mods/comment';
import { dalleMod } from '../mods/dalle';
import { debugMod } from '../mods/debug';
import { deleteMod, tagDeleteNotice } from '../mods/delete';
import { htmlMod, latexMod } from '../mods/editor';
import { emailMod } from '../mods/email';
import { embedMod } from '../mods/embed';
import { errorMod } from '../mods/error';
import { experimentsMod } from '../mods/experiments';
import { feedMod } from '../mods/feed';
import { fileMod } from '../mods/file';
import { folderMod } from '../mods/folder';
import { fullscreenMod } from '../mods/fullscreen';
import { gdprMod } from '../mods/gdpr';
import { graphMod } from '../mods/graph';
import { hideMod } from '../mods/hide';
import { homeMod } from '../mods/home';
import { htmlToMarkdownMod } from '../mods/htmlToMarkdown';
import { imageMod } from '../mods/image';
import { kanbanMod } from '../mods/kanban';
import { lensMod } from '../mods/lens';
import { mailboxMod } from '../mods/mailbox';
import { modMod } from '../mods/mod';
import { modlistMod } from '../mods/modlist';
import { ninjaTriangleMod } from '../mods/ninga-triangle';
import { notesMod } from '../mods/notes';
import { oembedMod } from '../mods/oembed';
import { remoteOriginMod } from '../mods/origin';
import { pdfMod } from '../mods/pdf';
import { personMod } from '../mods/person';
import { pipMod } from '../mods/pip';
import { playlistMod } from '../mods/playlist';
import { pollMod } from '../mods/poll';
import { qrMod } from '../mods/qr';
import { queueMod } from '../mods/queue';
import { repostMod } from '../mods/repost';
import { rootMod } from '../mods/root';
import { saveMod } from '../mods/save';
import { scrapeMod } from '../mods/scrape';
import { scriptMod } from '../mods/script';
import { seamlessMod } from '../mods/seamless';
import { secretMod } from '../mods/secret';
import { snippetMod } from '../mods/snippet';
import { summaryMod } from '../mods/summary';
import { systemMod } from '../mods/system';
import { tableMod } from '../mods/table';
import { thanksMod } from '../mods/thanks';
import { themesMod } from '../mods/theme';
import { threadMod } from '../mods/thread';
import { thumbnailMod } from '../mods/thumbnail';
import { todoMod } from '../mods/todo';
import { userMod } from '../mods/user';
import { videoMod } from '../mods/video';
import { voteMod } from '../mods/vote';
import { DEFAULT_WIKI_PREFIX, wikiMod } from '../mods/wiki';
import { progress } from '../store/bus';
import { Store } from '../store/store';
import { modId } from '../util/format';
import { getExtension, getHost } from '../util/http';
import { memo, MemoCache } from '../util/memo';
import { addHierarchicalTags, hasPrefix, hasTag, tagIntersection } from '../util/tag';
import { ExtService } from './api/ext.service';
import { OEmbedService } from './api/oembed.service';
import { PluginService } from './api/plugin.service';
import { RefService } from './api/ref.service';
import { ScrapeService } from './api/scrape.service';
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
    dalleMod,
    summaryMod,
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

  constructor(
    private config: ConfigService,
    private auth: AuthzService,
    private refs: RefService,
    private exts: ExtService,
    private users: UserService,
    private plugins: PluginService,
    private templates: TemplateService,
    private oembed: OEmbedService,
    private scrape: ScrapeService,
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
      tap(batch => this.pluginToStatus(batch.content)),
      switchMap(batch => !batch.content.length ? of(null) : this.loadPlugins$(page + 1)),
    );
  }

  private loadTemplates$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxTemplates) {
      console.error(`Too many templates to load, only loaded ${alreadyLoaded}. Increase maxTemplates to load more.`)
      return of(null);
    }
    return this.templates.page({query: this.localOriginQuery + ':!_config', page, size: this.config.fetchBatch}).pipe(
      tap(batch => this.templateToStatus(batch.content)),
      switchMap(batch => !batch.content.length ? of(null) : this.loadTemplates$(page + 1)),
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
        console.log(t.tag + ' needs update');
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

  get hosts() {
    return this.pluginConfigProperty('hosts');
  }

  get tmplSubmit() {
    return this.templateConfigProperty('submit');
  }

  get view() {
    return this.templateConfigProperty('view');
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

  get editingViewer() {
    return this.pluginConfigProperty('editingViewer');
  }

  get icons() {
    return this.configProperty('icons');
  }

  get actions() {
    return this.configProperty('actions');
  }

  get advancedActions() {
    return this.configProperty('advancedActions');
  }

  get published() {
    return this.pluginConfigProperty('published');
  }

  get themes() {
    return this.configProperty('themes');
  }

  get filters() {
    return this.configProperty('filters')
      .flatMap(p => p.config?.filters!);
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
    return uniq([...this.getPluginsForHost(url), ...this.getPluginsForExtension(url)]);
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

  getPluginsForExtension(url: string) {
    const type = getExtension(url)!;
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
        return hasTag(p.tag, match);
      }).map(addParent(p))
        .map(i => {
          if (!i.response && !i.anyResponse && !i.noResponse && !i.scheme) i.tag ||= p.tag;
          if (i.tag === p.tag)  i.title ||= p.name;
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
        return hasTag(config.tag, match);
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

  getPublished(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.published.filter(p => hasTag(p.tag, match))
      .flatMap(p => p.config!.published as string);
  }

  @memo
  getPlugin(tag: string) {
    return Object.values(this.status.plugins).find(p => p?.tag === tag);
  }

  @memo
  searchPlugins(text: string) {
    text = text.toLowerCase();
    return Object.values(this.status.plugins).filter(p => p?.tag.includes(text) || p?.name?.includes(text));
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

  getPluginSubForms(parent: string) {
    return this.forms.filter(p => p.config?.submitChild && hasPrefix(p.tag, parent));
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
    return Object.values(this.status.templates).filter(p => p?.tag.includes(text) || p?.name?.includes(text));
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
    return !!this.getTemplate('wiki')?.config?.external;
  }

  getWikiPrefix() {
    return this.getTemplate('wiki')?.config?.prefix || DEFAULT_WIKI_PREFIX;
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
    const defaultMod: <T extends Config> (t: T) => T = c =>( { ...c, config: { ...c.config || {}, mod: c.config?.mod || mod } });
    return concat(...[
      of(null).pipe(tap(() => _($localize`Installing ${mod} mod...`))),
      ...(bundle.ref || []).map(p => this.installRef$(p, _)),
      ...(bundle.ext || []).map(p => this.installExt$(p, _)),
      ...(bundle.user || []).map(p => this.installUser$(p, _)),
      ...(bundle.plugin || []).map(p => this.installPlugin$(defaultMod(p), _)),
      ...(bundle.template || []).map(t => this.installTemplate$(defaultMod(t), _)),
    ]).pipe(toArray());
  }

  installMod$(mod: string, _: progress): Observable<any> {
    return concat(...[
      of(null).pipe(tap(() => _($localize`Installing ${mod} mod...`))),
      ...Object.values(this.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.installPlugin$(p, _)),
      ...Object.values(this.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.installTemplate$(t, _)),
    ]).pipe(toArray());
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

  updatePlugin$(key: string, _: progress) {
    const def = this.def.plugins[key];
    const status = this.status.plugins[key];
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

  updateTemplate$(key: string, _: progress) {
    const def = this.def.templates[key];
    const status = this.status.templates[key];
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

  updateMod$(mod: string, _: progress): Observable<any> {
    return concat(...[
      of(null).pipe(tap(() => _($localize`Updating ${mod} mod...`))),
      ...Object.values(this.def.plugins)
        .filter(p => modId(p) === mod)
        .map(p => this.updatePlugin$(p.tag, _)),
      ...Object.values(this.def.templates)
        .filter(t => modId(t) === mod)
        .map(t => this.updateTemplate$(t.tag, _)),
    ]).pipe(toArray());
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
