import { flatten, without } from 'lodash-es';
import { action, autorun, computed, makeObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/wiki';
import { EventBus } from './bus';

export class SubmitStore {

  @observable
  wikiPrefix = DEFAULT_WIKI_PREFIX;
  @observable
  maxPreview = 300;
  @observable.shallow
  submitGenId: Plugin[] = [];
  @observable.shallow
  submitText: Plugin[] = [];
  @observable.shallow
  files: File[] = [] as any;
  @observable
  exts: Ext[] = [];
  @observable
  refs: Ref[] = [];
  @observable
  overwrite = false;
  @observable
  refLimitOverride = false;

  constructor(
    public route: RouterStore,
    private eventBus: EventBus,
  ) {
    makeObservable(this);

    autorun(() => {
      if (this.eventBus.event === 'refresh') {
        if (this.eventBus.ref) {
          this.setRef(this.eventBus.ref)
        }
      }
    });
  }

  @computed
  get subpage() {
    return this.route.routeSnapshot?.firstChild?.firstChild?.routeConfig?.path;
  }

  @computed
  get url() {
    return this.route.routeSnapshot?.queryParams['url'];
  }

  @computed
  get linkTypeOverride() {
    return this.route.routeSnapshot?.queryParams['linkTypeOverride'];
  }

  @computed
  get text() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'text';
    if (this.subpage != 'text') return false;
    return this.url?.startsWith('comment:') || !this.url;
  }

  @computed
  get wiki() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'wiki';
    return !!this.url?.startsWith(this.wikiPrefix);
  }

  @computed
  get to() {
    return this.route.routeSnapshot?.queryParams['to'];
  }

  @computed
  get tag() {
    return this.route.routeSnapshot?.queryParams['tag'] as string;
  }

  @computed
  get tags(): string[] {
    return flatten(this.tag ? [this.tag] : [])
      .flatMap( t => t.split(/[:|!()]/))
      .map(t => t.includes('@') ? t.substring(0, t.indexOf('@')) : t)
      .filter(t => t && !t.includes('*'));
  }

  @computed
  get repost() {
    return this.tags.includes('plugin/repost');
  }

  @computed
  get source() {
    return this.route.routeSnapshot?.queryParams['source'];
  }

  @computed
  get sources(): string[] {
    return flatten(this.source ? [this.source] : []);
  }

  @computed
  get web() {
    return !this.wiki && (!this.subpage || this.subpage === 'web');
  }

  @computed
  get upload() {
    return this.subpage === 'upload';
  }

  @computed
  get filesEmpty() {
    return !this.files.length;
  }

  @computed
  get empty() {
    return !this.exts.length && !this.refs.length;
  }

  @computed
  get genId() {
    return this.tags.find(t => this.submitGenId.find(p => p.tag === t));
  }

  @computed
  get textPlugin() {
    return this.tags.find(t => this.submitText.find(p => p.tag === t));
  }

  @computed
  get withoutGenId() {
    return without(this.tags, ...this.submitGenId.map(p => p.tag));
  }

  @computed
  get huge() {
    if (this.refLimitOverride) return false;
    return this.refs.length > 100 || this.exts.length > 100;
  }

  @action
  clearOverride() {
    this.refLimitOverride = false;
  }

  @action
  overrideHuge() {
    this.refLimitOverride = true;
  }

  @action
  addRefs(...refs: Ref[]) {
    this.refs = [...this.refs, ...refs];
  }

  @action
  addExts(...exts: Ext[]) {
    this.exts = [...this.exts, ...exts];
  }

  @action
  removeRef(ref: Ref) {
    this.refs = without(this.refs, ref);
  }

  @action
  removeExt(ext: Ext) {
    this.exts = without(this.exts, ext);
  }

  @action
  clearUpload() {
    this.exts = [];
    this.refs = [];
  }

  @action
  setFiles(files?: File[]) {
    if (!files) return;
    this.files ||= [];
    this.files.push(...files);
  }

  @action
  clearFiles() {
    if (this.filesEmpty) return;
    this.files = [] as any;
  }

  @action
  foundRef(url: string) {
    for (const r of this.refs) {
      if (r.url === url) {
        r.exists = true;
      }
    }
  }

  @action
  foundExt(tag: string) {
    for (const e of this.exts) {
      if (e.tag === tag) {
        e.exists = true;
      }
    }
  }

  @action
  setRef(ref: Ref) {
    for (let i = 0; i < this.refs.length; i++) {
      if (this.refs[i].url === ref.url) {
        this.refs[i] = ref;
      }
    }
  }

  @action
  setExt(ext: Ext) {
    for (let i = 0; i < this.exts.length; i++) {
      if (this.exts[i].tag === ext.tag) {
        this.exts[i] = ext;
      }
    }
  }

  @action
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
