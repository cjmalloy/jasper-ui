import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { findKey, isEqual, mapValues, omitBy, reduce, uniq } from 'lodash-es';
import { runInAction } from 'mobx';
import { catchError, concat, forkJoin, map, Observable, of, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { Config, Tag } from '../model/tag';
import { Template } from '../model/template';
import { aiPlugin, aiQueryPlugin, dallePlugin, dalleQueryPlugin } from '../mods/ai';
import { archivePlugin } from '../mods/archive';
import { audioPlugin } from '../mods/audio';
import { backgammonPlugin, backgammonTemplate } from '../mods/backgammon';
import { banlistConfig } from '../mods/banlist';
import { blogTemplate } from '../mods/blog';
import { chatTemplate } from '../mods/chat';
import { chessPlugin, chessTemplate } from '../mods/chess';
import { commentPlugin } from '../mods/comment';
import { breakpointPlugin, debugPlugin, debugTemplate } from '../mods/debug';
import { deletePlugin } from '../mods/delete';
import { htmlPlugin, latexPlugin } from '../mods/editor';
import { emailPlugin } from '../mods/email';
import { embedPlugin } from '../mods/embed';
import { experimentsConfig } from '../mods/experiments';
import { feedPlugin } from '../mods/feed';
import { filePlugin } from '../mods/file';
import { folderTemplate } from '../mods/folder';
import { fullscreenPlugin } from '../mods/fullscreen';
import { graphConfig } from '../mods/graph';
import { homeTemplate } from '../mods/home';
import { htmlToMarkdownConfig } from '../mods/htmlToMarkdown';
import { lockedIcon, privateIcon } from '../mods/icons';
import { imagePlugin, imageTemplate } from '../mods/image';
import { kanbanTemplate } from '../mods/kanban';
import { lensPlugin, lensTemplate } from '../mods/lens';
import { dmTemplate, inboxPlugin, outboxPlugin } from '../mods/mailbox';
import { modlistConfig } from '../mods/modlist';
import { oEmbedPlugin } from '../mods/oembed';
import { originPlugin, originPullPlugin, originPushPlugin, originTunnelPlugin } from '../mods/origin';
import { pdfPlugin } from '../mods/pdf';
import { personPlugin } from '../mods/person';
import { pipPlugin } from '../mods/pip';
import { playlistPlugin, playlistTemplate } from '../mods/playlist';
import { pollOptionAPlugin, pollOptionBPlugin, pollOptionCPlugin, pollOptionDPlugin, pollPlugin, pollTemplate } from '../mods/poll';
import { qrPlugin } from '../mods/qr';
import { invoiceDisputedPlugin, invoicePaidPlugin, invoicePlugin, invoiceRejectionPlugin, queueTemplate } from '../mods/queue';
import { repostPlugin } from '../mods/repost';
import { rootTemplate } from '../mods/root';
import { scrapePlugin } from '../mods/scrape';
import { seamlessPlugin } from '../mods/seamless';
import { snippetConfig } from '../mods/snippet';
import { summaryPlugin, summaryQueryPlugin } from '../mods/summary';
import { tablePlugin } from '../mods/table';
import { thanksConfig } from '../mods/thanks';
import { terminalTheme } from '../mods/theme';
import { threadPlugin } from '../mods/thread';
import { thumbnailPlugin } from '../mods/thumbnail';
import { todoPlugin, todoTemplate } from '../mods/todo';
import { userTemplate } from '../mods/user';
import { videoPlugin } from '../mods/video';
import { voteDownPlugin, voteUpPlugin } from '../mods/vote';
import { DEFAULT_WIKI_PREFIX, wikiConfig } from '../mods/wiki';
import { Store } from '../store/store';
import { getExtension, getHost } from '../util/hosts';
import { memo, MemoCache } from '../util/memo';
import { hasPrefix, includesTag, tagIntersection } from '../util/tag';
import { ExtService } from './api/ext.service';
import { OEmbedService } from './api/oembed.service';
import { PluginService } from './api/plugin.service';
import { ScrapeService } from './api/scrape.service';
import { TemplateService } from './api/template.service';
import { AuthzService } from './authz.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {

  status = {
    plugins: <Record<string, Plugin | undefined>> {},
    disabledPlugins: <Record<string, Plugin | undefined>> {},
    templates: <Record<string, Template | undefined>> {},
    disabledTemplates: <Record<string, Template | undefined>> {},
  };

  def = {
    plugins: <Record<string, Plugin>> {
      oembed: oEmbedPlugin,
      scrape: scrapePlugin,
      origin: originPlugin,
      originPull: originPullPlugin,
      originPush: originPushPlugin,
      originTunnel: originTunnelPlugin,
      feed: feedPlugin,
      delete: deletePlugin,
      inbox: inboxPlugin,
      outbox: outboxPlugin,
      comment: commentPlugin,
      thread: threadPlugin,
      email: emailPlugin,
      fullscreen: fullscreenPlugin,
      seamless: seamlessPlugin,
      thumbnail: thumbnailPlugin,
      table: tablePlugin,
      aiQuery: aiQueryPlugin,
      ai: aiPlugin,
      dalleQuery: dalleQueryPlugin,
      dalle: dallePlugin,
      summaryQuery: summaryQueryPlugin,
      summary: summaryPlugin,
      pdf: pdfPlugin,
      archive: archivePlugin,
      latex: latexPlugin,
      html: htmlPlugin,
      person: personPlugin,
      repost: repostPlugin,
      invoice: invoicePlugin,
      invoiceRejected: invoiceRejectionPlugin,
      invoiceDisputed: invoiceDisputedPlugin,
      invoicePaid: invoicePaidPlugin,
      qr: qrPlugin,
      embed: embedPlugin,
      audio: audioPlugin,
      video: videoPlugin,
      voteUp: voteUpPlugin,
      voteDown: voteDownPlugin,

      imagePlugin: imagePlugin,
      lensPlugin: lensPlugin,
      pipPlugin: pipPlugin,
      chessPlugin: chessPlugin,
      backgammonPlugin: backgammonPlugin,
      pollPlugin: pollPlugin,
      pollPluginA: pollOptionAPlugin,
      pollPluginB: pollOptionBPlugin,
      pollPluginC: pollOptionCPlugin,
      pollPluginD: pollOptionDPlugin,
      todoPlugin: todoPlugin,
      playlistPlugin: playlistPlugin,
      filePlugin: filePlugin,

      debugPlugin: debugPlugin,
      breakpoint: breakpointPlugin,
    },
    templates: <Record<string, Template>> {
      debugTemplate: debugTemplate,
      root: rootTemplate,
      user: userTemplate,
      folder: folderTemplate,
      home: homeTemplate,
      queue: queueTemplate,
      kanban: kanbanTemplate,
      blog: blogTemplate,
      chat: chatTemplate,
      dm: dmTemplate,

      imageTemplate: imageTemplate,
      lensTemplate: lensTemplate,
      chessTemplate: chessTemplate,
      bacgammonTemplate: backgammonTemplate,
      pollTemplate: pollTemplate,
      todoTemplate: todoTemplate,
      playlistTemplate: playlistTemplate,

      // Icons
      lockedIcon: lockedIcon,
      privateIcon: privateIcon,

      // Themes
      terminalTheme: terminalTheme,

      // Configs
      experiments: experimentsConfig,
      wiki: wikiConfig,
      graph: graphConfig,
      modlist: modlistConfig,
      banlist: banlistConfig,
      snippets: snippetConfig,
      htmlToMarkdown: htmlToMarkdownConfig,
      thanks: thanksConfig,
    },
  };

  _cache = new Map<string, any>();

  constructor(
    private config: ConfigService,
    private auth: AuthzService,
    private plugins: PluginService,
    private templates: TemplateService,
    private exts: ExtService,
    private oembed: OEmbedService,
    private ss: ScrapeService,
    private store: Store,
  ) { }

  get init$() {
    this._cache.clear();
    MemoCache.clear(this);
    runInAction(() => this.store.view.updates = false);
    this.status.plugins = mapValues(this.def.plugins, () => undefined);
    this.status.disabledPlugins = {};
    this.status.templates = mapValues(this.def.templates, () => undefined);
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
    if (Object.values(this.status.templates).filter(t => !!t).length > 0) return of(null);

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
      tap(() => this.oembed.defaults()),
      tap(() => this.ss.defaults()),
      switchMap(() => concat(...installs)),
      switchMap(() => this.init$)
    );
  }

  get localOriginQuery() {
    return this.store.account.origin || '*';
  }

  private get _extFallback() {
    return (x: Ext) => {
      if (x.modifiedString) return x;
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
      if (x.modifiedString) return x;
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

  private loadPlugins$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxPlugins) {
      console.error(`Too many plugins to load, only loaded ${alreadyLoaded}. Increase maxPlugins to load more.`)
      return of(null);
    }
    return this.plugins.page({query: this.localOriginQuery, page, size: this.config.fetchBatch}).pipe(
      tap(batch => this.pluginToStatus(batch.content)),
      switchMap(batch => batch.last ? of(null) : this.loadPlugins$(page + 1)),
    );
  }

  private loadTemplates$(page = 0): Observable<null> {
    const alreadyLoaded = page * this.config.fetchBatch;
    if (alreadyLoaded >= this.config.maxTemplates) {
      console.error(`Too many templates to load, only loaded ${alreadyLoaded}. Increase maxTemplates to load more.`)
      return of(null);
    }
    return this.templates.page({query: this.localOriginQuery, page, size: this.config.fetchBatch}).pipe(
      tap(batch => this.templateToStatus(batch.content)),
      switchMap(batch => batch.last ? of(null) : this.loadTemplates$(page + 1)),
    );
  }

  private pluginToStatus(list: Plugin[]) {
    for (const p of list) {
      const key = this.keyOf(this.def.plugins, p.tag);
      if (p.config?.deleted || p.config?.disabled) {
        this.status.disabledPlugins[key] = p;
      } else {
        this.status.plugins[key] = p;
      }
      p.config ||= {};
      p.config.needsUpdate ||= this.needsUpdate(this.def.plugins[key], p);
    }
  }

  private templateToStatus(list: Template[]) {
    for (const t of list) {
      const key = this.keyOf(this.def.templates, t.tag);
      if (t.config?.deleted || t.config?.disabled) {
        this.status.disabledTemplates[key] = t;
      } else {
        this.status.templates[key] = t;
      }
      t.config ||= {};
      t.config.needsUpdate ||= this.needsUpdate(this.def.templates[key], t);
    }
  }

  keyOf(dict: Record<string, Tag>, tag: string) {
    return findKey(dict, p => p.tag === tag) || tag || 'root';
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
    return this.pluginConfigProperty('reply');
  }

  get submit() {
    return this.pluginConfigProperty('submit', '!internal', '!settings');
  }

  get add() {
    return this.pluginConfigProperty('add');
  }

  get submitInternal() {
    return this.pluginConfigProperty('submit', 'internal', '!settings');
  }

  get submitText() {
    return this.pluginConfigProperty('submitText');
  }

  get settings() {
    return this.pluginConfigProperty('settings');
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

  get tmplView() {
    return this.templateConfigProperty('view');
  }

  get editors() {
    return this.pluginConfigProperty('editor');
  }

  get editorTags() {
    return this.editors.map(p => p.tag);
  }

  get uis() {
    return this.pluginConfigProperty('ui');
  }

  get infoUis() {
    return this.pluginConfigProperty('infoUi');
  }

  get forms() {
    return uniq([
      ...this.pluginConfigProperty('form'),
      ...this.pluginConfigProperty('advancedForm')
    ]);
  }

  get embeddable(): string[] {
    if (!this._cache.has('embeddable')) {
      this._cache.set('embeddable', Object.values(this.status.plugins).filter(p => {
        if (!p) return false;
        if (p?.config?.ui) return true;
        if (p === this.status.plugins.qr) return true;
        if (p === this.status.plugins.embed) return true;
        if (p === this.status.plugins.audio) return true;
        if (p === this.status.plugins.video) return true;
        if (p === this.status.plugins.imagePlugin) return true;
        if (p === this.status.plugins.pdf) return true;
        if (p === this.status.plugins.repost) return true;
        if (p === this.status.plugins.lensPlugin) return true;
        if (p === this.status.plugins.backgammonPlugin) return true;
        if (p === this.status.plugins.chessPlugin) return true;
        if (p === this.status.plugins.todoPlugin) return true;
        if (p === this.status.plugins.playlistPlugin) return true;
        return false;
      }).map(p => p!.tag));
    }
    return this._cache.get('embeddable')!;
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

  getEmbeds(ref: Ref) {
    const tags = ref.tags || [];
    return tagIntersection([
      'plugin',
      ...tags,
      ...this.getPluginsForUrl(ref.url).map(p => p.tag),
      ...(ref.alternateUrls || []).flatMap(url => this.getPluginsForUrl(url).map(p => p.tag)),
    ], this.embeddable) as string[];
  }

  getPluginsForUrl(url: string) {
    return uniq([...this.getPluginsForHost(url), ...this.getPluginsForExtension(url)]);
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
        if (a.condition && !config?.[p.tag]?.[a.condition]) return false;
        if (a.global) return true;
        return includesTag(p.tag, match);
      }).map(addParent(p)))
      .filter(a => !a.role || this.auth.hasRole(a.role));
  }

  getAdvancedActions(tags?: string[], config?: any) {
    const match = ['plugin', ...(tags || [])];
    return this.advancedActions
      .flatMap(p => p.config!.advancedActions!.filter(a => {
        if (a.condition && !config?.[p.tag]?.[a.condition]) return false;
        if (a.global) return true;
        return includesTag(p.tag, match);
      }).map(addParent(p)))
      .filter(a => !a.role || this.auth.hasRole(a.role));
  }

  getIcons(tags?: string[], config?: any, scheme?: string) {
    const match = ['plugin', ...(tags || [])];
    return this.icons
      .flatMap(p => p.config!.icons!.filter(i => {
        if (i.condition && !config?.[p.tag]?.[i.condition]) return false;
        if (i.global) return true;
        if (i.scheme && i.scheme === scheme) return true;
        return includesTag(p.tag, match);
      }).map(addParent(p))
        .map(i => {
          if (!i.response) i.tag ||= p.tag;
          if (i.tag === p.tag)  i.title ||= p.name;
          i.title ||= i.tag;
          return i;
        }))
      .filter(i => !i.role || this.auth.hasRole(i.role));
  }

  getTemplateView(tag: string) {
    return this.tmplView
      .filter(t => hasPrefix(tag, t.tag));
  }

  getPublished(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.published.filter(p => includesTag(p.tag, match))
      .flatMap(p => p.config!.published as string);
  }

  @memo
  getPlugin(tag: string) {
    return Object.values(this.status.plugins).find(p => p?.tag === tag);
  }

  getEditors(tags?: string[]) {
    const match = tags || [];
    return this.editors.filter(p => match.includes(p.tag));
  }

  getPluginUi(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.uis.filter(p => match.includes(p.tag));
  }

  getPluginInfoUis(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.infoUis.filter(p => match.includes(p.tag));
  }

  getPluginForms(tags?: string[]) {
    const match = ['plugin', ...(tags || [])];
    return this.forms.filter(p => match.includes(p.tag));
  }

  getPluginSubForms(parent: string) {
    return this.forms.filter(p => p.config?.submitChild && hasPrefix(p.tag, parent));
  }

  getTemplate(tag: string) {
    if (this.status.templates[tag]) return this.status.templates[tag];
    return Object.values(this.status.templates).find(t => {
      tag = tag.replace('+', '');
      if (t?.tag === tag) return true;
      tag = tag.replace('_', '');
      return t?.tag === tag;
    });
  }

  defaultConfig(tag: string) {
    return reduce(this.getTemplates(tag).map(t => t.defaults || {}), (prev, curr) => {
      return {...prev, ...curr};
    }, {});
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
        ...this.getTemplateForm(parent!),
        ...defaults
      };
    } else if (tag) {
      return this.getDefaults(parent!);
    }
    return undefined;
  }

  isWikiExternal() {
    return !!this.status.templates.wiki?.config?.external;
  }

  getWikiPrefix() {
    return this.status.templates.wiki?.config?.prefix || DEFAULT_WIKI_PREFIX;
  }

  needsUpdate(def: Plugin | Template, status: Plugin | Template) {
    if (!this.store.account.admin) return false;
    if (!def) return false;
    if (def.config?.noUpdate || status.config?.noUpdate) return false;
    if (def.config?.version != status.config?.version) {
      if (def.config?.version && status.config?.version) return def.config.version > status.config.version;
    }
    def = omitBy(def, i => !i) as any;
    status = omitBy(status, i => !i) as any;
    def.config = omitBy(def.config, i => !i);
    status.config = omitBy(status.config, i => !i);
    delete def.config!.generated;
    delete def.defaults;
    delete status.config!.generated;
    delete status.defaults;
    delete status.type;
    delete status.origin;
    delete status.modified;
    delete status.modifiedString;
    delete status._cache;
    return !isEqual(def, status);
  }
}

function addParent(c: Config) {
  return (a: any) => {
    a._parent = c;
    return a;
  };
}
