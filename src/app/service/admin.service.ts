import { Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';
import { commentPlugin } from '../plugin/comment';
import { emojiPlugin } from '../plugin/emoji';
import { inboxPlugin } from '../plugin/inbox';
import { latexPlugin } from '../plugin/latex';
import { rootTemplate } from '../template/root';
import { userTemplate } from '../template/user';
import { PluginService } from './api/plugin.service';
import { TemplateService } from './api/template.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {

  status = {
    plugins: {
      inbox: false,
      comment: false,
      latex: false,
      emoji: false,
    },
    templates: {
      root: false,
      user: false,
    },
  };

  def = {
    plugins: <Record<string, Plugin>>{
      inbox: inboxPlugin,
      comment: commentPlugin,
      latex: latexPlugin,
      emoji: emojiPlugin,
    },
    templates: <Record<string, Template>>{
      root: rootTemplate,
      user: userTemplate,
    },
  };

  constructor(
    private plugins: PluginService,
    private templates: TemplateService,
  ) { }

  get init$() {
    return forkJoin(
      forkJoin({
        inbox: this.plugins.exists('plugin/inbox'),
        comment: this.plugins.exists('plugin/comment'),
        latex: this.plugins.exists('plugin/latex'),
        emoji: this.plugins.exists('plugin/emoji'),
      }).pipe(tap(status => this.status.plugins = status)),
      forkJoin({
        root: this.templates.exists(''),
        user: this.templates.exists('user'),
      }).pipe(tap(status => this.status.templates = status)),
    );
  }
}
