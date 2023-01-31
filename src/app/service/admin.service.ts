import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import * as _ from 'lodash-es';
import { flatten } from 'lodash-es';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Action, Icon, Plugin, PluginFilter } from '../model/plugin';
import { Tag } from '../model/tag';
import { Template } from '../model/template';
import { archivePlugin } from '../plugin/archive';
import { audioPlugin } from '../plugin/audio';
import { commentPlugin } from '../plugin/comment';
import { deletePlugin } from '../plugin/delete';
import { embedPlugin } from '../plugin/embed';
import { emojiPlugin } from '../plugin/emoji';
import { feedPlugin } from '../plugin/feed';
import { graphPlugin } from '../plugin/graph';
import { imagePlugin } from '../plugin/image';
import { invoiceDisputedPlugin, invoicePaidPlugin, invoicePlugin, invoiceRejectionPlugin } from '../plugin/invoice';
import { latexPlugin } from '../plugin/latex';
import { inboxPlugin, outboxPlugin } from '../plugin/mailbox';
import { originPlugin } from '../plugin/origin';
import { pdfPlugin } from '../plugin/pdf';
import { personPlugin } from '../plugin/person';
import { qrPlugin } from '../plugin/qr';
import { rootPlugin } from '../plugin/root';
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
      inbox: inboxPlugin,
      outbox: outboxPlugin,
      comment: commentPlugin,
      thumbnail: thumbnailPlugin,
      pdf: pdfPlugin,
      archive: archivePlugin,
      latex: latexPlugin,
      emoji: emojiPlugin,
      person: personPlugin,
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

  private _uis?: string[];
  private _forms?: string[];
  private _embeddable?: string[];
  private _icons?: string[];
  private _actions?: string[];
  private _filters?: PluginFilter[];

  constructor(
    private config: ConfigService,
    private plugins: PluginService,
    private templates: TemplateService,
    private store: Store,
  ) { }

  get init$() {
    this._embeddable = undefined;
    this.status.plugins =  _.mapValues(this.def.plugins, () => undefined);
    this.status.templates = _.mapValues(this.def.templates, () => undefined);
    return forkJoin(this.loadPlugins$(), this.loadTemplates$());
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
    return _.findKey(dict, p => p.tag === tag) || tag;
  }

  get uis() {
    if (!this._uis) {
      this._uis = flatten(Object.values(this.status.plugins)
        .filter(p => p?.config?.ui)
        .map(p => p!.tag));
    }
    return this._uis;
  }

  get forms() {
    if (!this._forms) {
      this._forms = flatten(Object.values(this.status.plugins)
        .filter(p => p?.config?.form)
        .map(p => p!.tag));
    }
    return this._forms;
  }

  get embeddable() {
    if (!this._embeddable) {
      this._embeddable = Object.values(this.status.plugins)
        .filter(p => {
          if (!p) return false;
          if (p?.config?.ui) return true;
          if (p === this.status.plugins.qr) return true;
          if (p === this.status.plugins.embed) return true;
          if (p === this.status.plugins.audio) return true;
          if (p === this.status.plugins.video) return true;
          if (p === this.status.plugins.image) return true;
          return false;
        }).map(p => p!.tag);
    }
    return this._embeddable;
  }

  get icons() {
    if (!this._icons) {
      this._icons = flatten(Object.values(this.status.plugins)
        .filter(p => p?.config?.icons)
        .map(p => p!.tag));
    }
    return this._icons;
  }

  get actions() {
    if (!this._actions) {
      this._actions = flatten(Object.values(this.status.plugins)
        .filter(p => p?.config?.actions)
        .map(p => p!.tag));
    }
    return this._actions;
  }

  get filters() {
    if (!this._filters) {
      this._filters = flatten(Object.values(this.status.plugins)
        .filter(p => p?.config?.filters)
        .map(p => p!.config!.filters!));
    }
    return this._filters;
  }

  getEmbeds(tags: string[] = []) {
    return tagIntersection(['plugin', ...tags], this.embeddable);
  }

  getActions(tags: string[] = []) {
    return flatten(tagIntersection(['plugin', ...tags], this.actions)
      .map(t => this.getPlugin(t)!.config!.actions as Action[]));
  }

  getIcons(tags: string[] = []) {
    return flatten(tagIntersection(['plugin', ...tags], this.icons)
      .map(t => this.getPlugin(t)!.config!.icons as Icon[]));
  }

  getPlugin(tag: string) {
    return Object.values(this.status.plugins).find(p => p?.tag === tag);
  }

  getPluginUi(tags: string[] = []) {
    return tagIntersection(['plugin', ...tags], this.uis)
      .map(t => this.getPlugin(t)) as Plugin[];
  }

  getSubmitPlugins() {
    return Object.values(this.status.plugins)
      .filter(p => p?.config?.submit) as Plugin[];
  }

  getPluginForms(tags: string[] = []) {
    return tagIntersection(['plugin', ...tags], this.forms)
      .map(t => this.getPlugin(t)) as Plugin[];
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
