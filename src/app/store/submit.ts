import { flatten, without } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Plugin } from '../model/plugin';
import { DEFAULT_WIKI_PREFIX } from '../plugin/wiki';

export class SubmitStore {

  wikiPrefix = DEFAULT_WIKI_PREFIX;
  submitInternal: Plugin[] = [];
  files: FileList = [] as any;

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

  get scrape() {
    return this.route.routeSnapshot?.queryParams['scrape'] === 'true';
  }

  get web() {
    return !this.wiki && (!this.subpage || this.subpage === 'web');
  }

  get upload() {
    return this.subpage === 'upload';
  }

  get internal() {
    return this.tags.find(t => this.submitInternal.find(p => p.tag === t));
  }

  get withoutInternal() {
    return without(this.tags, ...this.submitInternal.map(p => p.tag));
  }
}
