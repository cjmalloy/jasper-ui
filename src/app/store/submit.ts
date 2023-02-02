import { filter, find, flatten } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Plugin } from '../model/plugin';
import { DEFAULT_WIKI_PREFIX } from '../plugin/wiki';

export class SubmitStore {

  plugins: Plugin[] = [];
  wikiPrefix = DEFAULT_WIKI_PREFIX;

  constructor(
    public route: RouterStore,
  ) {
    makeAutoObservable(this);
  }

  get subpage() {
    return this.route.routeSnapshot.firstChild?.firstChild?.routeConfig?.path;
  }

  get url() {
    return this.route.routeSnapshot?.queryParams['url'];
  }

  get linkTypeOverride() {
    return this.route.routeSnapshot?.queryParams['linkTypeOverride'];
  }

  get text() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'text';
    if (this.subpage != 'text') return false;
    return this.url?.startsWith('comment:') || !this.url;
  }

  get wiki() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'wiki';
    return !!this.url?.startsWith(this.wikiPrefix);
  }

  get tag() {
    return this.route.routeSnapshot?.queryParams['tag'];
  }

  get tags(): string[] {
    return flatten(this.tag ? [this.tag] : []);
  }

  get source() {
    return this.route.routeSnapshot?.queryParams['source'];
  }

  get sources(): string[] {
    return flatten(this.source ? [this.source] : []);
  }

  get feed() {
    return this.tags.includes('+plugin/feed');
  }

  get origin() {
    return this.tags.includes('+plugin/origin');
  }

  get link() {
    return !this.wiki && !find(this.tags, t => this.plugins.find(p => p.tag === t));
  }

  get web() {
    return this.link && (!this.subpage || this.subpage === 'web');
  }

  get tagsWithoutTab(): string[] {
    return filter(this.tags, t => !this.plugins.find(p => p.tag === t));
  }

  get activePlugins() {
    return this.plugins.filter(p => this.tags.includes(p.tag));
  }
}
