import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import flatten from 'css-flatten';
import { marked } from 'marked';
import { autorun, runInAction } from 'mobx';
import { of } from 'rxjs';
import { Plugin } from '../model/plugin';
import { Store } from '../store/store';
import { AccountService } from './account.service';
import { AdminService } from './admin.service';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root',
})
export class ModService {

  nesting = CSS && CSS.supports('selector(& > *)');

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private config: ConfigService,
    private admin: AdminService,
    private account: AccountService,
    private store: Store,
    private titleService: Title,
  ) { }

  get init$() {
    document.documentElement.style.overflowY = 'scroll';
    this.setTheme(localStorage.getItem('theme') || this.systemTheme);
    autorun(() => this.setCustomCss('custom-css', ...(this.store.account.config.userTheme ? this.getUserCss() : this.getExtCss())));
    this.admin.configProperty('css').forEach(p => this.setCustomCss(p.type + '-' + p.tag, p.config!.css));
    this.admin.configProperty('snippet').forEach(p => this.addSnippet(p.type + '-' + p.tag, p.config!.snippet));
    this.admin.configProperty('banner').forEach(p => this.addBanner(p.type + '-' + p.tag, p.config!.banner));
    this.account.checkConsent(this.admin.configProperty('consent').flatMap(p => Object.entries(p.config?.consent || {})));
    const ql = matchMedia && matchMedia('(prefers-color-scheme: dark)');
    if (ql.addEventListener) {
      ql.addEventListener('change', e => {
        if (!localStorage.getItem('theme')) this.setTheme(e.matches ? 'dark-theme' : 'light-theme');
      });
    }
    return of(null);
  }

  get systemTheme(): string {
    return matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-theme' : 'light-theme';
  }

  toggle(pin: boolean) {
    if (this.store.theme === 'light-theme') {
      this.setTheme('dark-theme', pin || 'if-not-system');
    } else {
      this.setTheme('light-theme', pin || 'if-not-system');
    }
  }

  setTheme(theme: string, save: boolean | 'if-not-system' = false) {
    if (save) {
      if (save === true || theme !== this.systemTheme) {
        localStorage.setItem('theme', theme);
      } else {
        localStorage.removeItem('theme');
      }
    }
    if (this.store.theme === theme) return;
    document.body.classList.add(theme);
    document.body.classList.remove(this.store.theme);
    runInAction(() => this.store.theme = theme!);
  }

  setCustomCss(id: string, ...cs: (string | undefined)[]) {
    id = id.replace(/\W/g, '_').replace(/\./g, '-') + '-css';
    const old = this.document.getElementById(id)
    if (old) old.remove();
    if (!cs || !cs.length || !cs[0]) return;
    const style = this.document.createElement('style');
    style.id = id;
    for (const css of cs) {
      style.innerHTML += (this.nesting ? css : flatten(css || '')) + '\n\n';
    }
    document.head.appendChild(style);
  }

  addSnippet(id: string, ...snippets: (string | undefined)[]) {
    id = id.replace(/\W/g, '_').replace(/\./g, '-') + '-snippet';
    const old = this.document.getElementById(id)
    if (old) old.remove();
    if (!snippets || !snippets.length || !snippets[0]) return;
    const nodes = this.document.createRange().createContextualFragment(snippets.join('\n\n'));
    for (let i = 0; i < nodes.children.length; i++) {
      const n = nodes.children[i];
      n.id = id + '-' + i;
    }
    document.head.appendChild(nodes);
  }

  addBanner(id: string, ...banners: (string | undefined)[]) {
    id = id.replace(/\W/g, '_').replace(/\./g, '-') + '-banner';
    const old = this.document.getElementById(id)
    if (old) old.remove();
    if (!banners || !banners.length || !banners[0]) return;
    const nodes = this.document.createRange().createContextualFragment(banners.join('\n\n'));
    for (let i = 0; i < nodes.children.length; i++) {
      const n = nodes.children[i];
      n.id = id + '-' + i;
    }
    document.body.appendChild(nodes);
  }

  setTitle(title: string) {
    this.titleService.setTitle(`${this.config.title} ± ${title}`);
  }

  exportHtml(plugin: Plugin): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${plugin.name || plugin.tag}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      html, body {
        color-scheme: dark;
        background-color: #222;
        color: #c9c9c9;
      }
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.8/handlebars.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
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
      document.getElementById("content").innerHTML = Handlebars.compile(document.getElementById("ui").innerHTML)(model);
      renderMathInElement(document.body, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left:  '$', right:  '$', display: false},
        ],
        throwOnError: false
      });
    }
  </script>
</head>
<body>
  <h1>${plugin.name || plugin.tag}</h1>
  <p>${marked(plugin.config?.aiInstructions || '')}</p>
  <div id="content"></div>
</body>
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
