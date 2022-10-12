import * as _ from 'lodash-es';
import { makeAutoObservable, observable } from 'mobx';
import { RouterStore } from 'mobx-angular';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { find, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';

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
    return _.difference(this.unloaded, this.loading);
  }

  get selectedPage() {
    return Page.of(this.selected.filter(s => !s.unloaded));
  }

  get minPublished() {
    return _.min(this.graphable.map(r => r.published).filter(p => !!p));
  }

  get maxPublished() {
    return _.max(this.graphable.map(r => r.published).filter(p => !!p));
  }

  get publishedDiff() {
    return this.maxPublished?.diff(this.minPublished) || 0;
  }

  set(refs: Ref[]) {
    this.loading = [];
    this.nodes = [...refs];
    this.selected = [...refs];
    if (this.showUnloaded) {
      this.nodes.push(...unloadedReferences(this.nodes, ...refs).map(url => ({ url, unloaded: true })));
    }
    this.links = links(this.nodes, ...this.nodes);
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
    this.selected = [...this.selected];
    if (this.showUnloaded) {
      this.nodes.push(..._.difference(unloadedReferences(this.nodes, ...refs), this.unloaded).map(url => ({ url, unloaded: true })));
    }
    this.links.push(...links(this.nodes, ...refs));
    _.pullAll(this.loading, refs.map(r => r.url));
  }

  remove(refs: Ref[]) {
    _.pullAll(this.nodes, refs);
    _.pullAll(this.selected, refs);
    for (const ref of refs) {
      _.remove(this.links, l => l.target === ref || l.source === ref);
    }
  }

  toggleShowUnloaded() {
    this.showUnloaded = !this.showUnloaded;
    if (this.showUnloaded) {
      if (this.showUnloaded) {
        this.nodes.push(...unloadedReferences(this.nodes, ...this.nodes).map(url => ({ url, unloaded: true })));
      }
    } else {
      _.remove(this.nodes, n => n.unloaded);
    }
    this.links = links(this.nodes, ...this.nodes);
  }

  select(...refs: Ref[]) {
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

  startLoading(...url: string[]) {
    this.loading.push(...url);
  }

  notFound(url: string) {
    let ref = find(this.nodes, url);
    if (!ref) {
      ref = { url, notFound: true };
      this.nodes.push(ref);
    }
    ref.notFound = true;
    ref.unloaded = false;
    _.pull(this.loading, url);
    if (!this.showUnloaded) {
      this.links.push(...linkSources(this.nodes, url));
    }
    // Trigger shallow observable
    this.selected = [...this.selected];
    return ref;
  }

  grabNodeOrSelection(ref: Ref) {
    if (!this.selected.includes(ref)) {
      this.selected = [ref];
    }
    return [...this.selected];
  }
}

