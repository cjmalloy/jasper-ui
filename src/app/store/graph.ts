import { assign, difference, max, min, pull, pullAll, remove } from 'lodash-es';
import { action, computed, makeObservable, observable } from 'mobx';
import { Page } from '../model/page';
import { RefNode } from '../model/ref';
import { findNode, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';

export class GraphStore {

  @observable.shallow
  selected: GraphNode[] = [];
  @observable.shallow
  nodes: GraphNode[] = [];
  @observable.shallow
  links: GraphLink[] = [];
  @observable
  loading: string[] = [];
  @observable
  timeline = false;
  @observable
  arrows = false;
  @observable
  showUnloaded = true;

  constructor() {
    makeObservable(this);
  }

  @computed
  get unloaded(): string[] {
    return this.nodes.filter(n => n.unloaded).map(n => n.url);
  }

  @computed
  get graphable(): GraphNode[] {
    return graphable(...this.nodes);
  }

  @computed
  get unloadedNotLoading(): string[] {
    return difference(this.unloaded, this.loading);
  }

  @computed
  get selectedPage() {
    return Page.of(this.selected.filter(s => !s.unloaded));
  }

  @computed
  get minPublished() {
    return min(this.graphable.map(r => r.published).filter(p => !!p));
  }

  @computed
  get maxPublished() {
    return max(this.graphable.map(r => r.published).filter(p => !!p));
  }

  @computed
  get publishedDiff() {
    return this.maxPublished?.diff(this.minPublished) || 0;
  }

  @action
  set(refs: RefNode[]) {
    this.loading = [];
    this.nodes = [...refs];
    this.selected = [...refs];
    if (this.showUnloaded) {
      this.nodes.push(...unloadedReferences(this.nodes, ...refs).map(url => ({ url, unloaded: true })));
    }
    this.links = links(this.nodes, ...this.nodes);
  }

  @action
  load(...refs: RefNode[]) {
    for (const ref of refs) {
      const found = findNode(this.nodes, ref.url);
      if (found) {
        assign(found, ref);
        found.unloaded = false;
      } else {
        this.nodes.push(ref);
      }
    }
    // Trigger shallow observable
    this.nodes = [...this.nodes];
    this.selected = [...this.selected];
    if (this.showUnloaded) {
      this.nodes.push(...difference(unloadedReferences(this.nodes, ...refs), this.unloaded).map(url => ({ url, unloaded: true })));
    }
    this.links.push(...links(this.nodes, ...refs));
    pullAll(this.loading, refs.map(r => r.url));
  }

  @action
  remove(refs: RefNode[]) {
    pullAll(this.nodes, refs);
    pullAll(this.selected, refs);
    for (const ref of refs) {
      remove(this.links, l => l.target === ref || l.source === ref);
    }
  }

  @action
  toggleShowUnloaded() {
    this.showUnloaded = !this.showUnloaded;
    if (this.showUnloaded) {
      if (this.showUnloaded) {
        this.nodes.push(...unloadedReferences(this.nodes, ...this.nodes).map(url => ({ url, unloaded: true })));
      }
    } else {
      remove(this.nodes, n => n.unloaded);
    }
    this.links = links(this.nodes, ...this.nodes);
  }

  @action
  select(...refs: GraphNode[]) {
    this.selected = [...refs];
  }

  @action
  selectAll() {
    this.selected = [...this.nodes];
  }

  @action
  clearSelection() {
    this.selected.length = 0;
  }

  @action
  getLoading(number: number) {
    if (this.unloadedNotLoading.length === 0) return [];
    const more = this.unloadedNotLoading.slice(0, number);
    this.loading.push(...more);
    return more;
  }

  @action
  startLoading(...url: string[]) {
    this.loading.push(...url);
  }

  @action
  notFound(url: string) {
    let ref = findNode(this.nodes, url);
    if (!ref) {
      ref = { url, notFound: true };
      this.nodes.push(ref);
    }
    ref.notFound = true;
    ref.unloaded = false;
    pull(this.loading, url);
    if (!this.showUnloaded) {
      this.links.push(...linkSources(this.nodes, url));
    }
    // Trigger shallow observable
    this.selected = [...this.selected];
    return ref;
  }

  @action
  grabNodeOrSelection(ref: RefNode) {
    if (!this.selected.includes(ref)) {
      this.selected = [ref];
    }
    return [...this.selected];
  }
}

