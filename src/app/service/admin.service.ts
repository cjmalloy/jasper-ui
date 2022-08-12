import { Injectable } from '@angular/core';
import * as _ from 'lodash-es';
import { catchError, forkJoin, map, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { Template } from '../model/template';
import { archivePlugin } from '../plugin/archive';
import { audioPlugin } from '../plugin/audio';
import { commentPlugin } from '../plugin/comment';
import { embedPlugin } from '../plugin/embed';
import { emojiPlugin } from '../plugin/emoji';
import { feedPlugin } from '../plugin/feed';
import { graphPlugin } from '../plugin/graph';
import { imagePlugin } from '../plugin/image';
import { inboxPlugin } from '../plugin/inbox';
import { invoiceDisputedPlugin, invoicePaidPlugin, invoicePlugin, invoiceRejectionPlugin } from '../plugin/invoice';
import { latexPlugin } from '../plugin/latex';
import { pdfPlugin } from '../plugin/pdf';
import { personPlugin } from '../plugin/person';
import { qrPlugin } from '../plugin/qr';
import { thumbnailPlugin } from '../plugin/thumbnail';
import { videoPlugin } from '../plugin/video';
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
      feed: feedPlugin,
      inbox: inboxPlugin,
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
    },
  };

  pluginKeys = Object.keys(this.def.plugins);
  templateKeys = Object.keys(this.def.templates);

  constructor(
    private plugins: PluginService,
    private templates: TemplateService,
  ) { }

  get init$() {
    if (this.pluginKeys.length + this.templateKeys.length < 1000) {
      return forkJoin(
        this.plugins.list(this.pluginKeys.map(k => this.def.plugins[k].tag)).pipe(
          map(list => this.listToStatus(this.pluginKeys, list)),
          tap(status => this.status.plugins = status),
        ),
        this.templates.list(this.templateKeys.map(k => this.def.templates[k].tag)).pipe(
          map(list => this.listToStatus(this.templateKeys, list)),
          tap(status => this.status.templates = status),
        ),
      );
    } else {
      return forkJoin(
        forkJoin(_.mapValues(this.def.plugins, p => this.plugins.get(p.tag).pipe(
          catchError(err => of(undefined)),
        ))).pipe(
          tap(status => this.status.plugins = status),
        ),
        forkJoin(_.mapValues(this.def.templates, t => this.templates.get(t.tag).pipe(
          catchError(err => of(undefined)),
        ))).pipe(
          tap(status => this.status.templates = status),
        ),
      );
    }
  }

  private listToStatus<T>(keys: string[], list: (T | undefined)[]): Record<string, T | undefined> {
    const result = <Record<string, T | undefined>> {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = list[i];
    }
    return result;
  }

  private _embedable?: string[];
  get embedable() {
    if (!this._embedable) {
      this._embedable = [];
      if (this.status.plugins.qr) this._embedable.push('plugin/qr');
      if (this.status.plugins.embed) this._embedable.push('plugin/embed');
      if (this.status.plugins.audio) this._embedable.push('plugin/audio');
      if (this.status.plugins.video) this._embedable.push('plugin/video');
      if (this.status.plugins.image) this._embedable.push('plugin/image');
    }
    return this._embedable;
  }

  getEmbeds(ref: Ref) {
    return _.intersection(ref.tags, this.embedable)
  }
}
