import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import flatten from 'css-flatten';
import { autorun, runInAction } from 'mobx';
import { of } from 'rxjs';
import { Plugin } from '../model/plugin';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class ModService {

  nesting = CSS.supports('selector(& > *)');

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private config: ConfigService,
    private admin: AdminService,
    private store: Store,
    private titleService: Title,
  ) { }

  get init$() {
    this.setTheme(localStorage.getItem('theme'));
    autorun(() => this.setCustomCss('custom-css', ...(this.store.account.config.userTheme ? this.getUserCss() : this.getExtCss())));
    this.admin.configProperty('css').forEach(p => this.setCustomCss(p.type + '-' + p.tag, p.config!.css));
    this.admin.configProperty('snippet').forEach(p => this.addSnippet(p.type + '-' + p.tag, p.config!.snippet));
    const ql = matchMedia && matchMedia('(prefers-color-scheme: dark)');
    ql.addEventListener && ql.addEventListener('change', e => {
      if (!localStorage.getItem('theme')) this.setTheme();
    });
    return of(null);
  }

  get systemTheme(): string {
    return matchMedia && matchMedia('(prefers-color-scheme: dark)') ? 'dark-theme' : 'light-theme';
  }

  toggle() {
    if (this.store.theme === 'light-theme') {
      this.setTheme('dark-theme');
    } else {
      this.setTheme('light-theme');
    }
  }

  setCustomCss(id: string, ...cs: (string | undefined)[]) {
    id = id.replace(/\W/g, '_').replace(/\./g, '-') + '-css';
    const old = this.document.getElementById(id)
    if (old) old.remove();
    if (!cs || !cs.length || !cs[0]) return;
    const head = this.document.getElementsByTagName('head')[0];
    const style = this.document.createElement('style');
    style.id = id;
    for (const css of cs) {
      style.innerHTML += (this.nesting ? css : flatten(css || '')) + '\n\n';
    }
    head.appendChild(style);
  }

  addSnippet(id: string, ...snippets: (string | undefined)[]) {
    id = id.replace(/\W/g, '_').replace(/\./g, '-') + '-snippet';
    const old = this.document.getElementById(id)
    if (old) old.remove();
    if (!snippets || !snippets.length || !snippets[0]) return;
    const head = this.document.getElementsByTagName('head')[0];
    const nodes = this.document.createRange().createContextualFragment(snippets.join('\n\n'));
    for (let i = 0; i < nodes.children.length; i++) {
      const n = nodes.children[i];
      n.id = id + '-' + i;
    }
    head.appendChild(nodes);
  }

  setTheme(theme?: string | null) {
    theme ??= this.systemTheme;
    if (this.store.theme === theme) return;
    if (theme !== this.systemTheme) {
      localStorage.setItem('theme', theme);
    } else {
      localStorage.removeItem('theme');
    }
    document.body.classList.add(theme);
    document.body.classList.remove(this.store.theme);
    runInAction(() => this.store.theme = theme!);
  }

  setTitle(title: string) {
    this.titleService.setTitle(`${this.config.title} ± ${title}`);
  }

  exportHtml(plugin: Plugin): string {
    return `<html>
<head>
  <meta charset="utf-8">
  <title>${plugin.name}</title>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.8/handlebars.min.js"></script>
  ${plugin.config?.snippet || ''}
  ${plugin.config?.css || ''}
  <script id="ui" type="text/x-handlebars-template">
    ${plugin.config?.ui || ''}
  </script>
  <script>
    window.onload = function() {
      Handlebars.registerHelper('d3', () => d3);
      Handlebars.registerHelper('defer', (el, fn) => {
        if (el.defered) {
          fn();
        } else {
          el.deferred = true;
          setTimeout(fn, 1);
        }
      });
      var model = {
        el: document.body
      };
      document.body.innerHTML = Handlebars.compile(document.getElementById("ui").innerHTML)(model);
    }
  </script>
</head>
<body></body>
</html>
`;
  }

  private getTheme(id: string, sources: Record<string, string>[]) {
    if (!id) return [];
    return sources.filter(ts => ts[id])
      .map(ts => ts[id] as string);
  }

  private getUserCss() {
    return this.getTheme(this.store.account.config.userTheme!, [this.store.account.config.themes || {}, ...this.admin.themes.map(p => p.config!.themes!)]);
  }

  private getExtCss() {
    return this.getTheme(this.store.view.ext?.config?.theme, [this.store.view.ext?.config?.themes || {}, ...this.admin.themes.map(p => p.config!.themes!)]);
  }
}
