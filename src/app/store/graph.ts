import { assign, difference, max, min, pull, pullAll, remove } from 'lodash-es';
import { makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Page } from '../model/page';
import { RefNode } from '../model/ref';
import { findNode, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';

export class GraphStore {

  selected: GraphNode[] = [];
  nodes: GraphNode[] = [];
  links: GraphLink[] = [];
  loading: string[] = [];
  timeline = false;
  arrows = false;
  showUnloaded = true;

  constructor(
    public route: RouterStore,
  ) {
    makeAutoObservable(this, {
      selected: observable.shallow,
      nodes: observable.shallow,
      links: observable.shallow,
    });
  }

  get unloaded(): string[] {
    return this.nodes.filter(n => n.unloaded).map(n => n.url);
  }

  get graphable(): GraphNode[] {
    return graphable(...this.nodes);
  }

  get unloadedNotLoading(): string[] {
    return difference(this.unloaded, this.loading);
  }

  get selectedPage() {
    return Page.of(this.selected.filter(s => !s.unloaded));
  }

  get minPublished() {
    return min(this.graphable.map(r => r.published).filter(p => !!p))!;
  }

  get maxPublished() {
    return max(this.graphable.map(r => r.published).filter(p => !!p))!;
  }

  get publishedDiff() {
    return this.maxPublished?.diff(this.minPublished).milliseconds || 0;
  }

  set(refs: RefNode[]) {
    this.loading = [];
    this.nodes = [...refs];
    this.selected = [...refs];
    if (this.showUnloaded) {
      this.nodes.push(...unloadedReferences(this.nodes, ...refs).map(url => ({ url, unloaded: true })));
    }
    this.links = links(this.nodes, ...this.nodes);
  }

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

  remove(refs: RefNode[]) {
    pullAll(this.nodes, refs);
    pullAll(this.selected, refs);
    for (const ref of refs) {
      remove(this.links, l => l.target === ref || l.source === ref);
    }
  }

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

  select(...refs: GraphNode[]) {
    this.selected = [...refs];
  }

  selectAll() {
    this.selected = [...this.nodes];
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

  startLoading(...url: string[]) {
    this.loading.push(...url);
  }

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

  grabNodeOrSelection(ref: RefNode) {
    if (!this.selected.includes(ref)) {
      this.selected = [ref];
    }
    return [...this.selected];
  }
}

