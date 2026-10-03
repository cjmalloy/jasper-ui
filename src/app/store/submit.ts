import { computed, signal, untracked } from '@angular/core';
import JSZip from 'jszip';
import { flatten, isArray, without } from 'lodash-es';
import { Ext } from '../model/ext';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { DEFAULT_WIKI_PREFIX } from '../mods/org/wiki';
import { refCacheIds } from '../util/cache';
import { EventBus } from './bus';
import { RouterStore } from './router';

export type Saving = { url?: string, name: string, progress?: number };
export class SubmitStore {

  readonly wikiPrefix = signal<string>(DEFAULT_WIKI_PREFIX);
  readonly submitGenId = signal<Plugin[]>([]);
  readonly submitDm = signal<Plugin[]>([]);
  readonly files = signal<File[]>([]);
  readonly embedFiles = signal<File[]>([]);
  readonly exts = signal<Ext[]>([]);
  readonly refs = signal<Ref[]>([]);
  readonly overwrite = signal<boolean>(false);
  readonly refLimitOverride = signal<boolean>(false);
  /**
   * Read only. Use setCaching() and removeCaching() to modify.
   */
  readonly caching = signal<ReadonlyMap<File, Saving>>(new Map());

  maxPreview = 300;
  /**
   * Cache files from uploaded zips, keyed by their original cache ID.
   */
  cacheFiles = new Map<string, JSZip.JSZipObject>();

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

  setCaching(file: File, saving: Saving) {
    this.caching.update(m => new Map(m).set(file, saving));
  }

  removeCaching(file: File) {
    this.caching.update(m => {
      const result = new Map(m);
      result.delete(file);
      return result;
    });
  }

  readonly topRefs = computed(() => {
    return this.refs().slice(0, 5);
  });

  readonly topExts = computed(() => {
    return this.exts().slice(0, 5);
  });

  readonly subpage = computed(() => {
    return this.route.routeSnapshot()?.firstChild?.firstChild?.routeConfig?.path;
  });

  readonly url = computed(() => {
    return this.route.routeSnapshot()?.queryParams['url'];
  });

  readonly linkTypeOverride = computed(() => {
    return this.route.routeSnapshot()?.queryParams['linkTypeOverride'];
  });

  readonly text = computed(() => {
    if (this.linkTypeOverride()) return this.linkTypeOverride() === 'text';
    if (this.subpage() != 'text') return false;
    return this.url()?.startsWith('comment:') || !this.url();
  });

  readonly wiki = computed(() => {
    if (this.linkTypeOverride()) return this.linkTypeOverride() === 'wiki';
    return !!this.url()?.startsWith(this.wikiPrefix());
  });

  readonly title = computed((): string => {
    return this.route.routeSnapshot()?.queryParams['title'] || '';
  });

  readonly to = computed((): string[] => {
    const tag = this.route.routeSnapshot()?.queryParams['to'];
    if (!tag) return [];
    return isArray(tag) ? tag : [tag];
  });

  readonly tag = computed(() => {
    return this.route.routeSnapshot()?.queryParams['tag'] as string;
  });

  readonly tags = computed((): string[] => {
    return flatten(this.tag() ? [this.tag()] : [])
      .flatMap( t => t.split(/[:|!()]/))
      .map(t => t.includes('@') ? t.substring(0, t.indexOf('@')) : t)
      .filter(t => t && !t.includes('*'));
  });

  readonly plugin = computed(() => {
    return this.route.routeSnapshot()?.queryParams['plugin'] || '' as string;
  });

  readonly pluginUpload = computed(() => {
    if (!this.plugin()) return '';
    return this.route.routeSnapshot()?.queryParams['upload'] || '' as string;
  });

  readonly repost = computed(() => {
    return this.tags().includes('plugin/repost');
  });

  readonly source = computed(() => {
    return this.route.routeSnapshot()?.queryParams['source'];
  });

  readonly sources = computed((): string[] => {
    return flatten(this.source() ? [this.source()] : []);
  });

  readonly web = computed(() => {
    return !this.wiki() && (!this.subpage() || this.subpage() === 'web');
  });

  readonly upload = computed(() => {
    return this.subpage() === 'upload';
  });

  readonly filesEmpty = computed(() => {
    return !this.files().length;
  });

  readonly empty = computed(() => {
    return !this.exts().length && !this.refs().length;
  });

  readonly genId = computed(() => {
    return this.tags().find(t => this.submitGenId().find(p => p.tag === t));
  });

  readonly dmPlugin = computed(() => {
    return [...this.tags(), ...this.to()].find(t => this.submitDm().find(p => p.tag === t));
  });

  readonly withoutGenId = computed(() => {
    if (!this.submitGenId().length) return this.tags();
    return without(this.tags(), ...this.submitGenId().map(p => p.tag));
  });

  readonly huge = computed(() => {
    if (this.refLimitOverride()) return false;
    return this.refs().length > 100 || this.exts().length > 100;
  });

  readonly uploads = computed(() => {
    return [...this.caching().values()];
  });

  clearOverride() {
    this.refLimitOverride.set(false);
  }

  overrideHuge() {
    this.refLimitOverride.set(true);
  }

  addRefs(...refs: Ref[]) {
    this.refs.update(r => [...r, ...refs]);
  }

  addExts(...exts: Ext[]) {
    this.exts.update(x => [...x, ...exts]);
  }

  removeRef(ref: Ref) {
    this.refs.update(refs => refs.filter(r => r.url !== ref.url || r.modifiedString !== ref.modifiedString));
  }

  removeExt(ext: Ext) {
    this.exts.update(exts => exts.filter(x => x.tag !== ext.tag || x.modifiedString !== ext.modifiedString));
  }

  clearUpload(refs: Ref[] = [], exts: Ext[] = []) {
    this.exts.set([...exts]);
    this.refs.set([...refs]);
    const keep = new Set(refs.flatMap(refCacheIds));
    for (const id of [...this.cacheFiles.keys()]) {
      if (!keep.has(id)) this.cacheFiles.delete(id);
    }
  }

  addCacheFiles(files: Map<string, JSZip.JSZipObject>) {
    for (const [id, file] of files) {
      if (this.cacheFiles.has(id)) {
        console.warn(`Skipping duplicate cache file in upload: ${id}`);
        continue;
      }
      this.cacheFiles.set(id, file);
    }
  }

  addFiles(files?: File[]) {
    if (!files) return;
    this.files.update(f => [...f || [], ...files]);
  }

  clearFiles() {
    if (untracked(() => this.filesEmpty())) return;
    this.files.set([]);
  }

  setEmbedFiles(files: File[] = []) {
    this.embedFiles.set([...files]);
  }

  foundRef(url: string) {
    this.refs.update(refs => refs.map(r => r.url === url ? { ...r, exists: true } : r));
  }

  foundExt(tag: string) {
    this.exts.update(exts => exts.map(e => e.tag === tag ? { ...e, exists: true } : e));
  }

  setRef(ref: Ref, url = ref.url) {
    this.refs.update(refs => refs.map(r => r.url === url ? ref : r));
  }

  setExt(ext: Ext) {
    this.exts.update(exts => exts.map(e => e.tag === ext.tag ? ext : e));
  }

  tagRefs(tags: string[]) {
    this.refs.update(refs => refs.map(ref => {
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
