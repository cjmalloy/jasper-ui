import * as _ from 'lodash-es';
import { action, computed, makeObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { find, GraphLink, GraphNode, links, references, unloadedReferences } from '../util/graph';

export class GraphStore {

  selected: GraphNode[] = [];
  nodes: GraphNode[] = [];
  links: GraphLink[] = [];
  loading: string[] = [];
  timeline = false;
  arrows = false;

  constructor(
    public route: RouterStore,
  ) {
    makeObservable(this, {
      selected: observable.shallow,
      nodes: observable.shallow,
      links: observable.shallow,
      loading: observable,
      timeline: observable,
      arrows: observable,
      references: computed,
      unloaded: computed,
      selectedPage: computed,
      minPublished: computed,
      maxPublished: computed,
      publishedDiff: computed,
      set: action,
      select: action,
      clearSelection: action,
      load: action,
      getLoading: action,
      startLoading: action,
      notFound: action,
      remove: action,
    });
  }

  get references(): string[] {
    return references(this.nodes);
  }

  get unloaded(): string[] {
    return this.nodes.filter(n => n.unloaded).map(n => n.url);
  }

  get unloadedNotLoading(): string[] {
    return _.difference(this.unloaded, this.loading);
  }

  get selectedPage() {
    return Page.of(this.selected.filter(s => !s.unloaded));
  }

  get minPublished() {
    return _.min(this.nodes.map(r => r.published).filter(p => !!p));
  }

  get maxPublished() {
    return _.max(this.nodes.map(r => r.published).filter(p => !!p));
  }

  get publishedDiff() {
    return this.maxPublished?.diff(this.minPublished) || 0;
  }

  set(refs: Ref[]) {
    this.loading = [];
    this.nodes = [...refs];
    this.selected = [...refs];
    this.links = links(...refs);
    this.nodes.push(...unloadedReferences(this.nodes, ...refs).map(url => ({ url, unloaded: true })));
  }

  load(...refs: Ref[]) {
    for (const ref of refs) {
      const found = find(this.nodes, ref.url);
      if (found) {
        _.assign(found, ref);
        found.unloaded = false;
      } else {
        this.nodes.push(ref);
      }
    }
    // Trigger shallow observable
    this.nodes = [...this.nodes];
    this.links.push(...links(...refs));
    this.nodes.push(..._.difference(unloadedReferences(this.nodes, ...refs), this.unloaded).map(url => ({ url, unloaded: true })));
    _.pullAll(this.loading, refs.map(r => r.url));
  }

  remove(refs: Ref[]) {
    _.pullAll(this.nodes, refs);
    for (const ref of refs) {
      _.remove(this.links, l =>
        l.target === ref.url || (l.target as any).url === ref.url ||
        l.source === ref.url || (l.source as any).url === ref.url);
    }
  }

  select(refs: Ref[]) {
    this.selected = [...refs];
  }

  clearSelection() {
    this.selected.length = 0;
  }

  getLoading(number: number) {
    if (this.unloadedNotLoading.length === 0) return [];
    const more = this.unloadedNotLoading.slice(0, number);
    this.loading.push(...more);
    return more;
  }

  startLoading(url: string) {
    this.loading.push(url);
  }

  notFound(url: string) {
    const ref = this.find(url)!;
    ref.notFound = true;
    ref.unloaded = false;
    _.pull(this.loading, url);
    return ref;
  }

  find(url: string) {
    return find(this.nodes, url);
  }
}

