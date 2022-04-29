import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { catchError, forkJoin, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';
import { commentPlugin } from '../plugin/comment';
import { embedPlugin } from '../plugin/embed';
import { emojiPlugin } from '../plugin/emoji';
import { graphPlugin } from '../plugin/graph';
import { inboxPlugin } from '../plugin/inbox';
import { invoiceDisputedPlugin, invoicePaidPlugin, invoicePlugin, invoiceRejectionPlugin } from '../plugin/invoice';
import { latexPlugin } from '../plugin/latex';
import { qrPlugin } from '../plugin/qr';
import { thumbnailPlugin } from '../plugin/thumbnail';
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
      inbox: inboxPlugin,
      comment: commentPlugin,
      thumbnail: thumbnailPlugin,
      latex: latexPlugin,
      emoji: emojiPlugin,
      graph: graphPlugin,
      invoice: invoicePlugin,
      invoiceRejected: invoiceRejectionPlugin,
      invoiceDisputed: invoiceDisputedPlugin,
      invoicePaid: invoicePaidPlugin,
      qr: qrPlugin,
      embed: embedPlugin,
    },
    templates: <Record<string, Template>> {
      root: rootTemplate,
      user: userTemplate,
      queue: queueTemplate,
    },
  };

  constructor(
    private plugins: PluginService,
    private templates: TemplateService,
  ) { }

  get init$() {
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
