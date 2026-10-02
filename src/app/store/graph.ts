import { computed, signal, untracked } from '@angular/core';
import { difference, max, min, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { Page } from '../model/page';
import { RefNode } from '../model/ref';
import { findNode, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';
import { RouterStore } from './router';

export class GraphStore {

  readonly selected = signal<GraphNode[]>([]);
  readonly nodes = signal<GraphNode[]>([]);
  readonly links = signal<GraphLink[]>([]);
  readonly loading = signal<string[]>([]);
  readonly timeline = signal(true);
  readonly arrows = signal(false);
  readonly showUnloaded = signal(true);

  readonly unloaded = computed(() => this.nodes().filter(n => n.unloaded).map(n => n.url));
  readonly graphable = computed(() => graphable(...this.nodes()));
  readonly unloadedNotLoading = computed(() => difference(this.unloaded(), this.loading()));
  readonly selectedPage = computed(() => Page.of(this.selected().filter(s => !s.unloaded)));
  readonly minPublished = computed((): DateTime => min(this.graphable().map(r => r.published).filter(p => !!p)) || DateTime.now().minus({ day: 1 }));
  readonly maxPublished = computed((): DateTime => max(this.graphable().map(r => r.published).filter(p => !!p)) || DateTime.now());
  readonly publishedDiff = computed(() => this.maxPublished()?.diff(this.minPublished()).milliseconds || 0);

  constructor(
    public route: RouterStore,
  ) { }

  set(refs: RefNode[]) {
    untracked(() => {
      const nodes: GraphNode[] = [...refs];
      if (this.showUnloaded()) {
        nodes.push(...unloadedReferences(nodes, ...refs).map(url => ({ url, unloaded: true })));
      }
      this.loading.set([]);
      this.nodes.set(nodes);
      this.selected.set([...refs]);
      this.links.set(links(nodes, ...nodes));
    });
  }

  load(...refs: RefNode[]) {
    untracked(() => {
      const nodes = [...this.nodes()];
      for (const ref of refs) {
        const found = findNode(nodes, ref.url);
        if (found) {
          nodes[nodes.indexOf(found)] = { ...found, ...ref, unloaded: false };
        } else {
          nodes.push(ref);
        }
      }
      if (this.showUnloaded()) {
        const unloaded = nodes.filter(n => n.unloaded).map(n => n.url);
        nodes.push(...difference(unloadedReferences(nodes, ...refs), unloaded).map(url => ({ url, unloaded: true })));
      }
      this.nodes.set(nodes);
      this.selected.update(selected => selected.map(n => findNode(nodes, n.url) || n));
      this.links.update(previous => [
        ...this.remapLinks(previous, nodes),
        ...links(nodes, ...refs),
      ]);
      this.loading.update(loading => without(loading, ...refs.map(r => r.url)));
    });
  }

  remove(refs: RefNode[]) {
    untracked(() => {
      const removed = new Set(refs.map(ref => ref.url));
      this.nodes.update(nodes => nodes.filter(n => !removed.has(n.url)));
      this.selected.update(selected => selected.filter(n => !removed.has(n.url)));
      this.links.update(links => links.filter(l =>
        !removed.has(typeof l.target === 'string' ? l.target : l.target.url)
        && !removed.has(typeof l.source === 'string' ? l.source : l.source.url)));
    });
  }

  toggleShowUnloaded() {
    untracked(() => {
      this.showUnloaded.set(!this.showUnloaded());
      let nodes = [...this.nodes()];
      if (this.showUnloaded()) {
        nodes.push(...unloadedReferences(nodes, ...nodes).map(url => ({ url, unloaded: true })));
      } else {
        nodes = nodes.filter(n => !n.unloaded);
      }
      this.nodes.set(nodes);
      this.links.set(links(nodes, ...nodes));
    });
  }

  select(...refs: GraphNode[]) {
    const nodes = untracked(this.nodes);
    this.selected.set(refs.map(ref => findNode(nodes, ref.url) || { ...ref }));
  }

  selectAll() {
    this.selected.set([...untracked(() => this.nodes())]);
  }

  clearSelection() {
    this.selected.set([]);
  }

  getLoading(number: number) {
    return untracked(() => {
      if (this.unloadedNotLoading().length === 0) return [];
      const more = this.unloadedNotLoading().slice(0, number);
      this.loading.update(loading => [...loading, ...more]);
      return more;
    });
  }

  startLoading(...url: string[]) {
    this.loading.update(loading => [...loading, ...url]);
  }

  notFound(url: string) {
    return untracked(() => {
      const nodes = [...this.nodes()];
      let ref = findNode(nodes, url);
      if (ref) {
        const index = nodes.indexOf(ref);
        ref = { ...ref, notFound: true, unloaded: false };
        nodes[index] = ref;
      } else {
        ref = { url, notFound: true, unloaded: false };
        nodes.push(ref);
      }
      this.nodes.set(nodes);
      this.loading.update(loading => without(loading, url));
      this.links.update(previous => [
        ...this.remapLinks(previous, nodes),
        ...!this.showUnloaded() ? linkSources(nodes, url) : [],
      ]);
      this.selected.update(selected => selected.map(n => findNode(nodes, n.url) || n));
      return ref;
    });
  }

  private remapLinks(previous: GraphLink[], nodes: GraphNode[]): GraphLink[] {
    return previous.map(link => ({
      ...link,
      source: typeof link.source === 'string' ? link.source : findNode(nodes, link.source.url) || link.source,
      target: typeof link.target === 'string' ? link.target : findNode(nodes, link.target.url) || link.target,
    }));
  }

  setPinned(pinned: boolean, ...refs: GraphNode[]) {
    const positions = new Map(refs.map(ref => [ref.url, ref]));
    this.nodes.update(nodes => nodes.map(node => {
      const position = positions.get(node.url);
      if (!position) return node;
      return {
        ...node,
        pinned,
        fx: pinned ? position.x ?? 0 : undefined,
        fy: pinned ? position.y ?? 0 : undefined,
      };
    }));
    const nodes = untracked(this.nodes);
    this.selected.update(selected => selected.map(node => findNode(nodes, node.url) || node));
    this.links.update(previous => this.remapLinks(previous, nodes));
  }

  grabNodeOrSelection(ref: RefNode) {
    return untracked(() => {
      if (!this.selected().some(node => node.url === ref.url)) {
        this.select(ref);
      }
      return [...this.selected()];
    });
  }
}
