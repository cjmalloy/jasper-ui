import { Injectable } from '@angular/core';
import * as moment from 'moment';
import { forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PluginService } from './api/plugin.service';
import { TemplateService } from './api/template.service';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  defaultSubscriptions = ['science@*', 'politics@*', '@infoman'];

  plugins = {
    inbox: false,
    comment: false,
  };

  templates = {
    default: false,
    user: false,
  }

  config = {
    generated: 'Generated by jenkins-ui ' + moment().toISOString(),
  };

  constructor(
    private pluginService: PluginService,
    private templateService: TemplateService,
  ) { }

  get init$() {
    return forkJoin(
      this.pluginService.exists('plugin/inbox').pipe(tap(exists => this.plugins.inbox = exists)),
      this.pluginService.exists('plugin/comment').pipe(tap(exists => this.plugins.comment = exists)),
      this.templateService.exists('').pipe(tap(exists => this.templates.default = exists)),
      this.templateService.exists('user').pipe(tap(exists => this.templates.user = exists)),
    )
  }
}
