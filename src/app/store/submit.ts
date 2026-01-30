import { effect, signal } from '@angular/core';
import { Router } from '@angular/router';
import { flatten, isArray, without } from 'lodash-es';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/org/wiki';
import { EventBus } from './bus';

export type Saving = { url?: string, name: string, progress?: number };

export class SubmitStore {

  private _wikiPrefix = signal(DEFAULT_WIKI_PREFIX);
  private _maxPreview = signal(300);
  private _submitGenId = signal<Plugin[]>([]);
  private _submitDm = signal<Plugin[]>([]);
  private _files = signal<File[]>([]);
  private _caching = signal(new Map<File, Saving>());
  private _exts = signal<Ext[]>([]);
  private _refs = signal<Ref[]>([]);
  private _overwrite = signal(false);
  private _refLimitOverride = signal(false);

  // Effect to handle refresh events (replaces MobX autorun)
  private _refreshEffect = effect(() => {
    if (this.eventBus.event === 'refresh') {
      const ref = this.eventBus.ref;
      if (ref) {
        this.setRef(ref);
      }
    }
  });

  constructor(
    private router: Router,
    private eventBus: EventBus,
  ) {}

  // Helper to get current route snapshot
  private get routeSnapshot() {
    // @ts-ignore - accessing internal router state
    return this.router.routerState?.snapshot?.root;
  }

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

  get topRefs() {
    return this._refs().slice(0, 5);
  }

  get topExts() {
    return this._exts().slice(0, 5);
  }

  get subpage() {
    return this.routeSnapshot?.firstChild?.firstChild?.routeConfig?.path;
  }

  get url() {
    return this.routeSnapshot?.queryParams['url'];
  }

  get linkTypeOverride() {
    return this.routeSnapshot?.queryParams['linkTypeOverride'];
  }

  get text() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'text';
    if (this.subpage != 'text') return false;
    return this.url?.startsWith('comment:') || !this.url;
  }

  get wiki() {
    if (this.linkTypeOverride) return this.linkTypeOverride === 'wiki';
    return !!this.url?.startsWith(this._wikiPrefix());
  }

  get title(): string {
    return this.routeSnapshot?.queryParams['title'] || '';
  }

  get to(): string[] {
    const tag = this.routeSnapshot?.queryParams['to'];
    if (!tag) return [];
    return isArray(tag) ? tag : [tag];
  }

  get tag() {
    return this.routeSnapshot?.queryParams['tag'] as string;
  }

  get tags(): string[] {
    return flatten(this.tag ? [this.tag] : [])
      .flatMap( t => t.split(/[:|!()]/))
      .map(t => t.includes('@') ? t.substring(0, t.indexOf('@')) : t)
      .filter(t => t && !t.includes('*'));
  }

  get plugin() {
    return this.routeSnapshot?.queryParams['plugin'] || '' as string;
  }

  get pluginUpload() {
    if (!this.plugin) return '';
    return this.routeSnapshot?.queryParams['upload'] || '' as string;
  }

  get repost() {
    return this.tags.includes('plugin/repost');
  }

  get source() {
    return this.routeSnapshot?.queryParams['source'];
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
    return !this._files().length;
  }

  get empty() {
    return !this._exts().length && !this._refs().length;
  }

  get genId() {
    return this.tags.find(t => this._submitGenId().find(p => p.tag === t));
  }

  get dmPlugin() {
    return [...this.tags, ...this.to].find(t => this._submitDm().find(p => p.tag === t));
  }

  get withoutGenId() {
    return without(this.tags, ...this._submitGenId().map(p => p.tag));
  }

  get huge() {
    if (this._refLimitOverride()) return false;
    return this._refs().length > 100 || this._exts().length > 100;
  }

  get uploads() {
    return [...this._caching().values()];
  }

  clearOverride() {
    this._refLimitOverride.set(false);
  }

  overrideHuge() {
    this._refLimitOverride.set(true);
  }

  addRefs(...refs: Ref[]) {
    this._refs.update(current => [...current, ...refs]);
  }

  addExts(...exts: Ext[]) {
    this._exts.update(current => [...current, ...exts]);
  }

  removeRef(ref: Ref) {
    this._refs.update(current => current.filter(r => r.url !== ref.url || r.modifiedString !== ref.modifiedString));
  }

  removeExt(ext: Ext) {
    this._exts.update(current => current.filter(x => x.tag !== ext.tag || x.modifiedString !== ext.modifiedString));
  }

  clearUpload(refs: Ref[] = [], exts: Ext[] = []) {
    this._exts.set(exts);
    this._refs.set(refs);
  }

  addFiles(files?: File[]) {
    if (!files) return;
    this._files.update(current => [...(current || []), ...files]);
  }

  clearFiles() {
    if (this.filesEmpty) return;
    this._files.set([]);
  }

  foundRef(url: string) {
    this._refs.update(current => {
      for (const r of current) {
        if (r.url === url) {
          r.exists = true;
        }
      }
      return [...current];
    });
  }

  foundExt(tag: string) {
    this._exts.update(current => {
      for (const e of current) {
        if (e.tag === tag) {
          e.exists = true;
        }
      }
      return [...current];
    });
  }

  setRef(ref: Ref) {
    this._refs.update(current => {
      const newRefs = [...current];
      for (let i = 0; i < newRefs.length; i++) {
        if (newRefs[i].url === ref.url) {
          newRefs[i] = ref;
        }
      }
      return newRefs;
    });
  }

  setExt(ext: Ext) {
    this._exts.update(current => {
      const newExts = [...current];
      for (let i = 0; i < newExts.length; i++) {
        if (newExts[i].tag === ext.tag) {
          newExts[i] = ext;
        }
      }
      return newExts;
    });
  }

  tagRefs(tags: string[]) {
    this._refs.update(current => {
      const newRefs = [...current];
      for (const ref of newRefs)
      for (const t of tags) {
        if (t.startsWith('-')) {
          const r = t.substring(1);
          if (ref.tags?.includes(r)) ref.tags.splice(ref.tags.indexOf(r), 1);
        } else if (!ref.tags?.includes(t)) {
          ref.tags ||= [];
          ref.tags.push(t)
        }
      }
      return newRefs;
    });
  }
}
