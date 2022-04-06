import { Component } from "@angular/core";
import { ThemeService } from "./service/theme.service";
import { AccountService } from "./service/account.service";
import { TemplateService } from "./service/template.service";
import { catchError, mergeMap, of } from "rxjs";
import { PluginService } from "./service/plugin.service";
import { printError } from "./util/http";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
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
    this.plugins.create({
      tag: 'plugin/comment',
      defaults: {},
      schema: {
        optionalProperties: {
          deleted: { type: "boolean" },
        },
      },
    }).pipe(
      mergeMap(() => this.templates.create({
        prefix: 'user',
        defaults: {
          inbox: {},
          subscriptions: ["science@*", "politics@*", "@infoman"]
        },
        schema: {
          properties: {
            inbox: {
              optionalProperties: {
                lastNotified: {type: "string"},
              },
            },
            subscriptions: { elements: {type: "string"} },
          },
          additionalProperties: true,
        },
      })),
      catchError(res => this.setupErrors = printError(res))
    ).subscribe(() => this.setupComplete = true);
  }

}
