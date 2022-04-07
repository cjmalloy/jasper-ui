import { Component } from '@angular/core';
import * as moment from 'moment';
import { catchError, forkJoin, of } from 'rxjs';
import { AccountService } from './service/account.service';
import { PluginService } from './service/api/plugin.service';
import { TemplateService } from './service/api/template.service';
import { ThemeService } from './service/theme.service';
import { printError } from './util/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  doSetup = false;
  setupComplete = false;
  setupErrors?: string[];

  constructor(
    public account: AccountService,
    private plugins: PluginService,
    private templates: TemplateService,
    private theme: ThemeService,
  ) {
    templates.get('user').pipe(
      catchError(err => of(this.doSetup = true)),
    ).subscribe();
  }

  setupJasper() {
    const config = {
      author: this.account.tag,
      generated: 'Generated by jenkins-ui ' + moment().toISOString(),
    };
    forkJoin(
      this.plugins.create({
        tag: 'plugin/comment',
        config,
        defaults: {},
        schema: {
          optionalProperties: {
            deleted: { type: 'boolean' },
          },
        },
      }),
      this.plugins.create({
        tag: 'plugin/inbox',
        config,
      }),
      this.templates.create({
        prefix: '',
        config,
        defaults: {
          pinned: [],
        },
        schema: {
          properties: {
            pinned: { elements: { type: 'string' } },
          },
          optionalProperties: {
            sidebar: { type: 'string' },
          },
        },
      }),
      this.templates.create({
        prefix: 'user',
        config,
        defaults: {
          inbox: {},
          subscriptions: ['science@*', 'politics@*', '@infoman'],
        },
        schema: {
          properties: {
            inbox: {
              optionalProperties: {
                lastNotified: { type: 'string' },
              },
            },
            subscriptions: { elements: { type: 'string' } },
          },
        },
      }),
    ).pipe(
      catchError(res => this.setupErrors = printError(res)),
    ).subscribe(() => this.setupComplete = true);
  }

}
