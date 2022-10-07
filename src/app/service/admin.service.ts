import { Injectable } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import * as _ from 'lodash-es';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plugin } from '../model/plugin';
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
import { thumbnailPlugin } from '../plugin/thumbnail';
import { videoPlugin } from '../plugin/video';
import { Store } from '../store/store';
import { blogTemplate } from '../template/blog';
import { chatTemplate } from '../template/chat';
import { kanbanTemplate } from '../template/kanban';
import { queueTemplate } from '../template/queue';
import { rootTemplate } from '../template/root';
import { userTemplate } from '../template/user';
import { PluginService } from './api/plugin.service';
import { TemplateService } from './api/template.service';

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
    },
    templates: <Record<string, Template>> {
      root: rootTemplate,
      user: userTemplate,
      queue: queueTemplate,
      kanban: kanbanTemplate,
      blog: blogTemplate,
      chat: chatTemplate,
    },
  };

  private _embeddable?: string[];
  private fetchBatch = 50;

  constructor(
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

  get originQuery() {
    return this.store.account.origin || '*';
  }

  private loadPlugins$(page = 0): Observable<null> {
    return this.plugins.page({query: this.originQuery, page, size: this.fetchBatch}).pipe(
      tap(batch => this.pluginToStatus(batch.content)),
      switchMap(batch => batch.last ? of(null) : this.loadPlugins$(page + 1)),
    );
  }

  private loadTemplates$(page = 0): Observable<null> {
    return this.templates.page({query: this.originQuery, page, size: this.fetchBatch}).pipe(
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

  getEmbeds(tags: string[] = []) {
    return _.intersection(tags, this.embeddable);
  }

  getPlugin(tag: string) {
    return Object.values(this.status.plugins).find(p => p?.tag === tag);
  }

  getPluginUi(tags: string[] = []) {
    return tags
      .map(t => this.getPlugin(t))
      .filter(p => p?.config?.ui) as Plugin[];
  }

  getPluginForms(tags: string[] = []) {
    return tags
      .map(t => this.getPlugin(t))
      .filter(p => p?.config?.form) as Plugin[];
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
}
