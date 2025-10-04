import { computed, effect, Injectable, signal } from '@angular/core';
import { flatten, isArray, without } from 'lodash-es';
import { RouterStore } from 'mobx-angular';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/wiki';
import { EventBus } from './bus';

export type Saving = { url?: string, name: string, progress?: number };

@Injectable({
  providedIn: 'root'
})
export class SubmitStore {

  private _wikiPrefix = signal(DEFAULT_WIKI_PREFIX);
  private _maxPreview = signal(300);
  private _submitGenId = signal<Plugin[]>([]);
  private _submitDm = signal<Plugin[]>([]);
  private _files = signal<File[]>([] as any);
  private _caching = signal(new Map<File, Saving>());
  private _exts = signal<Ext[]>([]);
  private _refs = signal<Ref[]>([]);
  private _overwrite = signal(false);
  private _refLimitOverride = signal(false);

  // Backwards compatible getters/setters
  get wikiPrefix() { return this._wikiPrefix(); }
  set wikiPrefix(value: string) { this._wikiPrefix.set(value); }

  get maxPreview() { return this._maxPreview(); }
  set maxPreview(value: number) { this._maxPreview.set(value); }

  get submitGenId() { return this._submitGenId(); }
  set submitGenId(value: Plugin[]) { this._submitGenId.set(value); }

  get submitDm() { return this._submitDm(); }
  set submitDm(value: Plugin[]) { this._submitDm.set(value); }

  get files() { return this._files(); }
  set files(value: File[]) { this._files.set(value); }

  get caching() { return this._caching(); }
  set caching(value: Map<File, Saving>) { this._caching.set(value); }

  get exts() { return this._exts(); }
  set exts(value: Ext[]) { this._exts.set(value); }

  get refs() { return this._refs(); }
  set refs(value: Ref[]) { this._refs.set(value); }

  get overwrite() { return this._overwrite(); }
  set overwrite(value: boolean) { this._overwrite.set(value); }

  get refLimitOverride() { return this._refLimitOverride(); }
  set refLimitOverride(value: boolean) { this._refLimitOverride.set(value); }

  // New signal-based API
  wikiPrefix$ = computed(() => this._wikiPrefix());
  maxPreview$ = computed(() => this._maxPreview());
  submitGenId$ = computed(() => this._submitGenId());
  submitDm$ = computed(() => this._submitDm());
  files$ = computed(() => this._files());
  caching$ = computed(() => this._caching());
  exts$ = computed(() => this._exts());
  refs$ = computed(() => this._refs());
  overwrite$ = computed(() => this._overwrite());
  refLimitOverride$ = computed(() => this._refLimitOverride());

  constructor(
    public route: RouterStore,
    private eventBus: EventBus,
  ) {
    // Replace MobX autorun with Angular effect
    effect(() => {
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
