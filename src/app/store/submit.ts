import { flatten, without } from 'lodash-es';
import { autorun, makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/wiki';
import { EventBus } from './bus';

export class SubmitStore {

  wikiPrefix = DEFAULT_WIKI_PREFIX;
  maxPreview = 300;
  submitGenId: Plugin[] = [];
  submitText: Plugin[] = [];
  files: File[] = [] as any;
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
      submitText: observable.shallow,
      files: observable.shallow,
    });

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.eventBus.ref) {
          this.setRef(this.eventBus.ref)
        }
      }
    });
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

  get to() {
    return this.route.routeSnapshot?.queryParams['to'];
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

  get textPlugin() {
    return this.tags.find(t => this.submitText.find(p => p.tag === t));
  }

  get withoutGenId() {
    return without(this.tags, ...this.submitGenId.map(p => p.tag));
  }

  get huge() {
    if (this.refLimitOverride) return false;
    return this.refs.length > 100 || this.exts.length > 100;
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
    this.refs = without(this.refs, ref);
  }

  removeExt(ext: Ext) {
    this.exts = without(this.exts, ext);
  }

  clearUpload() {
    this.exts = [];
    this.refs = [];
  }

  setFiles(files?: File[]) {
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
