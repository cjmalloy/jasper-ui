import * as _ from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';

export class SubmitStore {

  plugins: string[] = [];

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
    return this.url?.startsWith('wiki:');
  }

  get tag() {
    return this.route.routeSnapshot?.queryParams['tag'];
  }

  get tags(): string[] {
    return _.flatten(this.tag ? [this.tag] : []);
  }

  get feed() {
    return this.tags.includes('+plugin/feed');
  }

  get origin() {
    return this.tags.includes('+plugin/origin');
  }

  get link() {
    return !this.wiki && !_.find(this.tags, t => this.plugins.includes(t));
  }

  get noPlugins() {
    return _.without(this.tags, ...this.plugins);
  }
}
