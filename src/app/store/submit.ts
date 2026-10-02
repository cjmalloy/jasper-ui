import { computed, signal, untracked } from '@angular/core';
import { flatten, isArray, without } from 'lodash-es';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/org/wiki';
import { EventBus } from './bus';
import { RouterStore } from './router';

export type Saving = { url?: string, name: string, progress?: number };
export class SubmitStore {

  private readonly _wikiPrefix = signal<string>(DEFAULT_WIKI_PREFIX);
  private readonly _submitGenId = signal<Plugin[]>([]);
  private readonly _submitDm = signal<Plugin[]>([]);
  private readonly _files = signal<File[]>([]);
  private readonly _embedFiles = signal<File[]>([]);
  private readonly _exts = signal<Ext[]>([]);
  private readonly _refs = signal<Ref[]>([]);
  private readonly _overwrite = signal<boolean>(false);
  private readonly _refLimitOverride = signal<boolean>(false);
  private readonly _caching = signal(new Map<File, Saving>());

  maxPreview = 300;

  constructor(
    public route: RouterStore,
    private eventBus: EventBus,
  ) {
    this.eventBus.events.subscribe(event => {
      if (event.event === 'refresh') {
        if (event.ref) {
          this.setRef(event.ref)
        }
      }
    });
  }

  get wikiPrefix() { return this._wikiPrefix(); }
  set wikiPrefix(value: string) { this._wikiPrefix.set(value); }

  get submitGenId() { return this._submitGenId(); }
  set submitGenId(value: Plugin[]) { this._submitGenId.set(value); }

  get submitDm() { return this._submitDm(); }
  set submitDm(value: Plugin[]) { this._submitDm.set(value); }

  get files() { return this._files(); }
  set files(value: File[]) { this._files.set(value); }

  get embedFiles() { return this._embedFiles(); }
  set embedFiles(value: File[]) { this._embedFiles.set(value); }

  get exts() { return this._exts(); }
  set exts(value: Ext[]) { this._exts.set(value); }

  get refs() { return this._refs(); }
  set refs(value: Ref[]) { this._refs.set(value); }

  get overwrite() { return this._overwrite(); }
  set overwrite(value: boolean) { this._overwrite.set(value); }

  get refLimitOverride() { return this._refLimitOverride(); }
  set refLimitOverride(value: boolean) { this._refLimitOverride.set(value); }

  /**
   * Read only. Use setCaching() and removeCaching() to modify.
   */
  get caching(): ReadonlyMap<File, Saving> { return this._caching(); }

  setCaching(file: File, saving: Saving) {
    this._caching.update(m => new Map(m).set(file, saving));
  }

  removeCaching(file: File) {
    this._caching.update(m => {
      const result = new Map(m);
      result.delete(file);
      return result;
    });
  }

  private readonly _topRefs = computed(() => {
    return this.refs.slice(0, 5);
  });
  get topRefs() {
    return this._topRefs();
  }

  private readonly _topExts = computed(() => {
    return this.exts.slice(0, 5);
  });
  get topExts() {
    return this._topExts();
  }

  private readonly _subpage = computed(() => {
    return this.route.routeSnapshot?.firstChild?.firstChild?.routeConfig?.path;
  });
  get subpage() {
    return this._subpage();
  }

  private readonly _url = computed(() => {
    return this.route.routeSnapshot?.queryParams['url'];
  });
  get url() {
    return this._url();
  }

  private readonly _linkTypeOverride = computed(() => {
    return this.route.routeSnapshot?.queryParams['linkTypeOverride'];
  });
  get linkTypeOverride() {
    return this._linkTypeOverride();
  }

  private readonly _text = computed(() => {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'text';
    if (this.subpage != 'text') return false;
    return this.url?.startsWith('comment:') || !this.url;
  });
  get text() {
    return this._text();
  }

  private readonly _wiki = computed(() => {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'wiki';
    return !!this.url?.startsWith(this.wikiPrefix);
  });
  get wiki() {
    return this._wiki();
  }

  private readonly _title = computed((): string => {
    return this.route.routeSnapshot?.queryParams['title'] || '';
  });
  get title(): string {
    return this._title();
  }

  private readonly _to = computed((): string[] => {
    const tag = this.route.routeSnapshot?.queryParams['to'];
    if (!tag) return [];
    return isArray(tag) ? tag : [tag];
  });
  get to(): string[] {
    return this._to();
  }

  private readonly _tag = computed(() => {
    return this.route.routeSnapshot?.queryParams['tag'] as string;
  });
  get tag() {
    return this._tag();
  }

  private readonly _tags = computed((): string[] => {
    return flatten(this.tag ? [this.tag] : [])
      .flatMap( t => t.split(/[:|!()]/))
      .map(t => t.includes('@') ? t.substring(0, t.indexOf('@')) : t)
      .filter(t => t && !t.includes('*'));
  });
  get tags(): string[] {
    return this._tags();
  }

  private readonly _plugin = computed(() => {
    return this.route.routeSnapshot?.queryParams['plugin'] || '' as string;
  });
  get plugin() {
    return this._plugin();
  }

  private readonly _pluginUpload = computed(() => {
    if (!this.plugin) return '';
    return this.route.routeSnapshot?.queryParams['upload'] || '' as string;
  });
  get pluginUpload() {
    return this._pluginUpload();
  }

  private readonly _repost = computed(() => {
    return this.tags.includes('plugin/repost');
  });
  get repost() {
    return this._repost();
  }

  private readonly _source = computed(() => {
    return this.route.routeSnapshot?.queryParams['source'];
  });
  get source() {
    return this._source();
  }

  private readonly _sources = computed((): string[] => {
    return flatten(this.source ? [this.source] : []);
  });
  get sources(): string[] {
    return this._sources();
  }

  private readonly _web = computed(() => {
    return !this.wiki && (!this.subpage || this.subpage === 'web');
  });
  get web() {
    return this._web();
  }

  private readonly _upload = computed(() => {
    return this.subpage === 'upload';
  });
  get upload() {
    return this._upload();
  }

  private readonly _filesEmpty = computed(() => {
    return !this.files.length;
  });
  get filesEmpty() {
    return this._filesEmpty();
  }

  private readonly _empty = computed(() => {
    return !this.exts.length && !this.refs.length;
  });
  get empty() {
    return this._empty();
  }

  private readonly _genId = computed(() => {
    return this.tags.find(t => this.submitGenId.find(p => p.tag === t));
  });
  get genId() {
    return this._genId();
  }

  private readonly _dmPlugin = computed(() => {
    return [...this.tags, ...this.to].find(t => this.submitDm.find(p => p.tag === t));
  });
  get dmPlugin() {
    return this._dmPlugin();
  }

  private readonly _withoutGenId = computed(() => {
    if (!this.submitGenId.length) return this.tags;
    return without(this.tags, ...this.submitGenId.map(p => p.tag));
  });
  get withoutGenId() {
    return this._withoutGenId();
  }

  private readonly _huge = computed(() => {
    if (this.refLimitOverride) return false;
    return this.refs.length > 100 || this.exts.length > 100;
  });
  get huge() {
    return this._huge();
  }

  private readonly _uploads = computed(() => {
    return [...this.caching.values()];
  });
  get uploads() {
    return this._uploads();
  }

  clearOverride() {
    this.refLimitOverride = false;
  }

  overrideHuge() {
    this.refLimitOverride = true;
  }

  addRefs(...refs: Ref[]) {
    this._refs.update(r => [...r, ...refs]);
  }

  addExts(...exts: Ext[]) {
    this._exts.update(x => [...x, ...exts]);
  }

  removeRef(ref: Ref) {
    this._refs.update(refs => refs.filter(r => r.url !== ref.url || r.modifiedString !== ref.modifiedString));
  }

  removeExt(ext: Ext) {
    this._exts.update(exts => exts.filter(x => x.tag !== ext.tag || x.modifiedString !== ext.modifiedString));
  }

  clearUpload(refs: Ref[] = [], exts: Ext[] = []) {
    this.exts = exts;
    this.refs = refs;
  }

  addFiles(files?: File[]) {
    if (!files) return;
    this._files.update(f => [...f || [], ...files]);
  }

  clearFiles() {
    if (untracked(() => this.filesEmpty)) return;
    this.files = [];
  }

  setEmbedFiles(files: File[] = []) {
    this.embedFiles = files;
  }

  foundRef(url: string) {
    this._refs.update(refs => refs.map(r => r.url === url ? { ...r, exists: true } : r));
  }

  foundExt(tag: string) {
    this._exts.update(exts => exts.map(e => e.tag === tag ? { ...e, exists: true } : e));
  }

  setRef(ref: Ref) {
    this._refs.update(refs => refs.map(r => r.url === ref.url ? ref : r));
  }

  setExt(ext: Ext) {
    this._exts.update(exts => exts.map(e => e.tag === ext.tag ? ext : e));
  }

  tagRefs(tags: string[]) {
    this._refs.update(refs => refs.map(ref => {
      let result = [...ref.tags || []];
      for (const t of tags) {
        if (t.startsWith('-')) {
          result = result.filter(r => r !== t.substring(1));
        } else if (!result.includes(t)) {
          result.push(t);
        }
      }
      if (!ref.tags && !result.length) return ref;
      return { ...ref, tags: result };
    }));
  }
}
