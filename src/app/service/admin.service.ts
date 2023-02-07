import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { findKey, flatten, mapValues } from 'lodash-es';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ext } from '../model/ext';
import { Action, Icon, Plugin } from '../model/plugin';
import { Tag } from '../model/tag';
import { Template } from '../model/template';
import { aprioriPlugin } from '../plugin/apriori';
import { archivePlugin } from '../plugin/archive';
import { audioPlugin } from '../plugin/audio';
import { commentPlugin } from '../plugin/comment';
import { deletePlugin } from '../plugin/delete';
import { htmlPlugin, latexPlugin } from '../plugin/editor';
import { emailPlugin } from '../plugin/email';
import { embedPlugin } from '../plugin/embed';
import { feedPlugin } from '../plugin/feed';
import { graphPlugin } from '../plugin/graph';
import { imagePlugin } from '../plugin/image';
import { invoiceDisputedPlugin, invoicePaidPlugin, invoicePlugin, invoiceRejectionPlugin } from '../plugin/invoice';
import { inboxPlugin, outboxPlugin } from '../plugin/mailbox';
import { originPlugin } from '../plugin/origin';
import { pdfPlugin } from '../plugin/pdf';
import { personPlugin } from '../plugin/person';
import { qrPlugin } from '../plugin/qr';
import { repostPlugin } from '../plugin/repost';
import { rootPlugin } from '../plugin/root';
import { terminalThemePlugin } from '../plugin/theme';
import { thumbnailPlugin } from '../plugin/thumbnail';
import { videoPlugin } from '../plugin/video';
import { DEFAULT_WIKI_PREFIX, wikiPlugin } from '../plugin/wiki';
import { Store } from '../store/store';
import { blogTemplate } from '../template/blog';
import { chatTemplate } from '../template/chat';
import { homeTemplate } from '../template/home';
import { kanbanTemplate } from '../template/kanban';
import { queueTemplate } from '../template/queue';
import { rootTemplate } from '../template/root';
import { userTemplate } from '../template/user';
import { tagIntersection } from '../util/tag';
import { ExtService } from './api/ext.service';
import { PluginService } from './api/plugin.service';
import { TemplateService } from './api/template.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {

  status = {
    plugins: <Record<string, Plugin | undefined>> {},
    templates: <Record<string, Template | undefined>> {},
  };

  def = {
    plugins: <Record<string, Plugin>> {
      root: rootPlugin,
      origin: originPlugin,
      feed: feedPlugin,
      delete: deletePlugin,
      apriori: aprioriPlugin,
      inbox: inboxPlugin,
      outbox: outboxPlugin,
      comment: commentPlugin,
      email: emailPlugin,
      thumbnail: thumbnailPlugin,
      pdf: pdfPlugin,
      archive: archivePlugin,
      latex: latexPlugin,
      html: htmlPlugin,
      person: personPlugin,
      repost: repostPlugin,
      graph: graphPlugin,
      invoice: invoicePlugin,
      invoiceRejected: invoiceRejectionPlugin,
      invoiceDisputed: invoiceDisputedPlugin,
      invoicePaid: invoicePaidPlugin,
      qr: qrPlugin,
      embed: embedPlugin,
      audio: audioPlugin,
      video: videoPlugin,
      image: imagePlugin,
      wiki: wikiPlugin,

      // Themes
      terminalTheme: terminalThemePlugin,
    },
    templates: <Record<string, Template>> {
      root: rootTemplate,
      user: userTemplate,
      home: homeTemplate,
      queue: queueTemplate,
      kanban: kanbanTemplate,
      blog: blogTemplate,
      chat: chatTemplate,
    },
  };

 _cache = new Map<string, any>();

  constructor(
    private config: ConfigService,
    private plugins: PluginService,
    private templates: TemplateService,
    private exts: ExtService,
    private store: Store,
  ) { }

  get init$() {
    this._cache.clear();
    this.status.plugins =  mapValues(this.def.plugins, () => undefined);
    this.status.templates = mapValues(this.def.templates, () => undefined);
    return forkJoin([this.loadPlugins$(), this.loadTemplates$()]).pipe(
      switchMap(() => this.firstRun$),
    );
  }

  get firstRun$(): Observable<any> {
    if (!this.store.account.admin || this.store.account.ext) return of(null);
    if (Object.values(this.status.plugins).filter(p => !!p).length > 0) return of(null);
    if (Object.values(this.status.templates).filter(t => !!t).length > 0) return of(null);

    const installs = this.defaultPlugins.map(p => this.plugins.create({
      ...p,
      origin: this.store.account.origin,
    }));
    installs.push(...this.defaultTemplates.map(t => this.templates.create({
      ...t,
      origin: this.store.account.origin,
    })));
    return this.exts.create({
      tag: this.store.account.localTag,
      origin: this.store.account.origin,
    }).pipe(
      switchMap(() => forkJoin(installs)),
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
    for (const t of list) {
      this.status.plugins[this.keyOf(this.def.plugins, t.tag)] = t;
    }
  }

  private templateToStatus(list: Template[]) {
    for (const t of list) {
      this.status.templates[this.keyOf(this.def.templates, t.tag)] = t;
    }
  }

  keyOf(dict: Record<string, Tag>, tag: string) {
    return findKey(dict, p => p.tag === tag) || tag;
  }

  pluginConfigProperty(name: string): Plugin[] {
    if (!this._cache.has(name)) {
      this._cache.set(name, Object.values(this.status.plugins).filter(p => p?.config?.[name]));
    }
    return this._cache.get(name)!;
  }

  get defaultPlugins() {
    return Object.values(this.def.plugins).filter(p => p?.config?.default) as Plugin[];
  }

  get defaultTemplates() {
    return Object.values(this.def.templates).filter(t => t?.config?.default) as Template[];
  }

  get readAccess() {
    return this.pluginConfigProperty('readAccess').flatMap(p => p.config!.readAccess!);
  }

  get writeAccess() {
    return this.pluginConfigProperty('writeAccess').flatMap(p => p.config!.writeAccess!);
  }

  get submit() {
    return this.pluginConfigProperty('submit').map(p => p!.tag);
  }

  get editors() {
    return this.pluginConfigProperty('editor').map(p => p!.tag);
  }

  get uis() {
    return this.pluginConfigProperty('ui').map(p => p!.tag);
  }

  get forms() {
    return this.pluginConfigProperty('form').map(p => p!.tag);
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
        if (p === this.status.plugins.image) return true;
        return false;
      }).map(p => p!.tag));
    }
    return this._cache.get('embeddable')!;
  }

  get icons() {
    return this.pluginConfigProperty('icons').map(p => p!.tag);
  }

  get actions() {
    return this.pluginConfigProperty('actions').map(p => p!.tag);
  }

  get published() {
    return this.pluginConfigProperty('published').map(p => p!.tag);
  }

  get filters() {
    if (!this._cache.has('filters')) {
      this._cache.set('filters', flatten(Object.values(this.status.plugins)
        .filter(p => p?.config?.filters)
        .map(p => p!.config!.filters!)));
    }
    return this._cache.get('filters')!;
  }

  getEmbeds(tags?: string[]) {
    return tagIntersection(['plugin', ...(tags || [])], this.embeddable);
  }

  getActions(tags?: string[]) {
    return this.getPlugins(tagIntersection(['plugin', ...(tags || [])], this.actions))
      .flatMap(p => p.config!.actions as Action[]);
  }

  getIcons(tags?: string[]) {
    return this.getPlugins(tagIntersection(['plugin', ...(tags || [])], this.icons))
      .flatMap(p => p.config!.icons?.map(i => {
        if (!i.response) i.tag ||= p.tag;
        if (i.tag === p.tag)  i.title ||= p.name;
        i.title ||= i.tag;
        return i;
      }) as Icon[]);
  }

  getPublished(tags?: string[]) {
    return this.getPlugins(tagIntersection(['plugin', ...(tags || [])], this.published))
      .flatMap(p => p.config!.published as string);
  }

  getPlugin(tag: string) {
    return Object.values(this.status.plugins).find(p => p?.tag === tag);
  }

  getPlugins(tags?: string[] | string[][]) {
    if (!tags || !tags.length) return [];
    const ts: string[] = flatten(tags)!;
    return Object.values(this.status.plugins).filter(p => p?.tag && ts.includes(p.tag)) as Plugin[];
  }

  getPluginUi(tags?: string[]) {
    return this.getPlugins(tagIntersection(['plugin', ...(tags || [])], this.uis));
  }

  getPluginForms(tags?: string[]) {
    return this.getPlugins(tagIntersection(['plugin', ...(tags || [])], this.forms));
  }

  getTemplate(tag: string) {
    tag = tag.replace('+', '');
    if (this.status.templates[tag]) return this.status.templates[tag];
    return Object.values(this.status.templates).find(t => t?.tag === tag);
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
      return [...this.getTemplateForm(parent!), ...form]
    } else if (tag) {
      return this.getTemplateForm(parent!);
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
    return {};
  }

  isWikiExternal() {
    return !!this.status.plugins.wiki?.config?.external;
  }

  getWikiPrefix() {
    return this.status.plugins.wiki?.config?.prefix || DEFAULT_WIKI_PREFIX;
  }
}
