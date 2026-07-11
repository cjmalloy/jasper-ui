import { flatten, isArray, without } from 'lodash-es';
import { action, autorun, makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/org/wiki';
import { EventBus } from './bus';

export type Saving = { url?: string, name: string, progress?: number };
export class SubmitStore {

  wikiPrefix = DEFAULT_WIKI_PREFIX;
  maxPreview = 300;
  submitGenId: Plugin[] = [];
  submitDm: Plugin[] = [];
  files: File[] = [] as any;
  caching: Map<File, Saving> = new Map<File, Saving>();
  exts: Ext[] = [];
  refs: Ref[] = [];
  overwrite = false;
  refLimitOverride = false;

  constructor(
    public route: RouterStore,
    private eventBus: EventBus,
  ) {
    makeAutoObservable(this, {
      submitGenId: observable.shallow,
      submitDm: observable.shallow,
      files: observable.shallow,
      caching: observable.shallow,
      setRef: action,
      setExt: action,
    });

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.eventBus.ref) {
          this.setRef(this.eventBus.ref)
        }
      }
    });
  }

  get topRefs() {
    return this.refs.slice(0, 5);
  }

  get topExts() {
    return this.exts.slice(0, 5);
  }

  get subpage() {
    return this.route.routeSnapshot?.firstChild?.firstChild?.routeConfig?.path;
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

  get title(): string {
    return this.route.routeSnapshot?.queryParams['title'] || '';
  }

  get to(): string[] {
    const tag = this.route.routeSnapshot?.queryParams['to'];
    if (!tag) return [];
    return isArray(tag) ? tag : [tag];
  }

  get tag() {
    return this.route.routeSnapshot?.queryParams['tag'] as string;
  }

  get tags(): string[] {
    return flatten(this.tag ? [this.tag] : [])
      .flatMap( t => t.split(/[:|!()]/))
      .map(t => t.includes('@') ? t.substring(0, t.indexOf('@')) : t)
      .filter(t => t && !t.includes('*'));
  }

  get plugin() {
    return this.route.routeSnapshot?.queryParams['plugin'] || '' as string;
  }

  get pluginUpload() {
    if (!this.plugin) return '';
    return this.route.routeSnapshot?.queryParams['upload'] || '' as string;
  }

  get repost() {
    return this.tags.includes('plugin/repost');
  }

  get source() {
    return this.route.routeSnapshot?.queryParams['source'];
  }

  get sources(): string[] {
    return flatten(this.source ? [this.source] : []);
  }

  get web() {
    return !this.wiki && (!this.subpage || this.subpage === 'web');
  }

  get upload() {
    return this.subpage === 'upload';
  }

  get filesEmpty() {
    return !this.files.length;
  }

  get empty() {
    return !this.exts.length && !this.refs.length;
  }

  get genId() {
    return this.tags.find(t => this.submitGenId.find(p => p.tag === t));
  }

  get dmPlugin() {
    return [...this.tags, ...this.to].find(t => this.submitDm.find(p => p.tag === t));
  }

  get withoutGenId() {
    if (!this.submitGenId.length) return this.tags;
    return without(this.tags, ...this.submitGenId.map(p => p.tag));
  }

  get huge() {
    if (this.refLimitOverride) return false;
    return this.refs.length > 100 || this.exts.length > 100;
  }

  get uploads() {
    return [...this.caching.values()];
  }

  clearOverride() {
    this.refLimitOverride = false;
  }

  overrideHuge() {
    this.refLimitOverride = true;
  }

  addRefs(...refs: Ref[]) {
    this.refs = [...this.refs, ...refs];
  }

  addExts(...exts: Ext[]) {
    this.exts = [...this.exts, ...exts];
  }

  removeRef(ref: Ref) {
    this.refs = this.refs.filter(r => r.url !== ref.url || r.modifiedString !== ref.modifiedString);
  }

  removeExt(ext: Ext) {
    this.exts = this.exts.filter(x => x.tag !== ext.tag || x.modifiedString !== ext.modifiedString);
  }

  clearUpload(refs: Ref[] = [], exts: Ext[] = []) {
    this.exts = exts;
    this.refs = refs;
  }

  addFiles(files?: File[]) {
    if (!files) return;
    this.files ||= [];
    this.files.push(...files);
  }

  clearFiles() {
    if (this.filesEmpty) return;
    this.files = [] as any;
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

  tagRefs(tags: string[]) {
    for (const ref of this.refs)
    for (const t of tags) {
      if (t.startsWith('-')) {
        const r = t.substring(1);
        if (ref.tags?.includes(r)) ref.tags.splice(ref.tags.indexOf(r), 1);
      } else if (!ref.tags?.includes(t)) {
        ref.tags ||= [];
        ref.tags.push(t)
      }
    }
  }
}
