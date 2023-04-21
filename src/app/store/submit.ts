import { flatten, without } from 'lodash-es';
import { autorun, makeAutoObservable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../plugin/wiki';
import { EventBus } from './bus';

export class SubmitStore {

  wikiPrefix = DEFAULT_WIKI_PREFIX;
  submitInternal: Plugin[] = [];
  files: FileList = [] as any;
  exts: Ext[] = [];
  refs: Ref[] = [];
  overwrite = false;

  constructor(
    public route: RouterStore,
    private eventBus: EventBus,
  ) {
    makeAutoObservable(this);

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.eventBus.ref) {
          this.setRef(this.eventBus.ref)
        }
      }
    });
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

  get empty() {
    return !this.exts.length && !this.refs.length;
  }

  get internal() {
    return this.tags.find(t => this.submitInternal.find(p => p.tag === t));
  }

  get withoutInternal() {
    return without(this.tags, ...this.submitInternal.map(p => p.tag));
  }

  removeRef(ref: Ref) {
    this.refs = without(this.refs, ref);
  }

  removeExt(ext: Ext) {
    this.exts = without(this.exts, ext);
  }

  addModels(refs?: Ref[], exts?: Ext[]) {
    this.exts = [...this.exts, ...(exts || [])];
    this.refs = [...this.refs, ...(refs || [])];
  }

  clearUpload() {
    this.files = [] as any;
    this.exts = [];
    this.refs = [];
  }

  setFiles(files?: FileList | []) {
    if (files === this.files) return;
    if (!files?.[0]) {
      this.files = [] as any;
      return;
    }
    this.files = files as any;
  }

  foundRef(url: string) {
    for (const r of this.refs) {
      if (r.url === url) {
        r.exists = true;
      }
    }
  }

  foundExt(tag: string) {
    for (const e of this.exts) {
      if (e.tag === tag) {
        e.exists = true;
      }
    }
  }

  setRef(ref: Ref) {
    for (let i = 0; i < this.refs.length; i++) {
      if (this.refs[i].url === ref.url) {
        this.refs[i] = ref;
      }
    }
  }

  setExt(ext: Ext) {
    for (let i = 0; i < this.exts.length; i++) {
      if (this.exts[i].tag === ext.tag) {
        this.exts[i] = ext;
      }
    }
  }
}
