import * as _ from 'lodash-es';
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

  get url() {
    return this.route.routeSnapshot?.queryParams['url'];
  }

  get linkTypeOverride() {
    return this.route.routeSnapshot?.queryParams['linkTypeOverride'];
  }

  get text() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'text';
    return this.url?.startsWith('comment:');
  }

  get wiki() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'wiki';
    return !!this.url?.startsWith(this.wikiPrefix);
  }

  get tag() {
    return this.route.routeSnapshot?.queryParams['tag'];
  }

  get tags(): string[] {
    return _.flatten(this.tag ? [this.tag] : []);
  }

  get source() {
    return this.route.routeSnapshot?.queryParams['source'];
  }

  get sources(): string[] {
    return _.flatten(this.source ? [this.source] : []);
  }

  get feed() {
    return this.tags.includes('+plugin/feed');
  }

  get origin() {
    return this.tags.includes('+plugin/origin');
  }

  get link() {
    return !this.wiki && !_.find(this.tags, t => this.plugins.find(p => p.tag === t));
  }

  get tagsWithoutTab() {
    return _.filter(this.tags, t => !this.plugins.find(p => p.tag === t));
  }

  get activePlugins() {
    return this.plugins.filter(p => this.tags.includes(p.tag));
  }
}
