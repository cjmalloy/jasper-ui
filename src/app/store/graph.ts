import { computed, signal, untracked } from '@angular/core';
import { assign, difference, max, min, without } from 'lodash-es';
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
          assign(found, ref);
          found.unloaded = false;
        } else {
          nodes.push(ref);
        }
      }
      if (this.showUnloaded()) {
        const unloaded = nodes.filter(n => n.unloaded).map(n => n.url);
        nodes.push(...difference(unloadedReferences(nodes, ...refs), unloaded).map(url => ({ url, unloaded: true })));
      }
      this.nodes.set(nodes);
      this.selected.set([...this.selected()]);
      this.links.set([...this.links(), ...links(nodes, ...refs)]);
      this.loading.set(without(this.loading(), ...refs.map(r => r.url)));
    });
  }

  remove(refs: RefNode[]) {
    untracked(() => {
      this.nodes.set(without(this.nodes(), ...refs));
      this.selected.set(without(this.selected(), ...refs));
      this.links.set(this.links().filter(l => !refs.find(ref => l.target === ref || l.source === ref)));
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
    this.selected.set([...refs]);
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
      this.loading.set([...this.loading(), ...more]);
      return more;
    });
  }

  startLoading(...url: string[]) {
    this.loading.set([...untracked(() => this.loading()), ...url]);
  }

  notFound(url: string) {
    return untracked(() => {
      const nodes = [...this.nodes()];
      let ref = findNode(nodes, url);
      if (!ref) {
        ref = { url, notFound: true };
        nodes.push(ref);
      }
      ref.notFound = true;
      ref.unloaded = false;
      this.nodes.set(nodes);
      this.loading.set(without(this.loading(), url));
      if (!this.showUnloaded()) {
        this.links.set([...this.links(), ...linkSources(nodes, url)]);
      }
      this.selected.set([...this.selected()]);
      return ref;
    });
  }

  grabNodeOrSelection(ref: RefNode) {
    return untracked(() => {
      if (!this.selected().includes(ref)) {
        this.selected.set([ref]);
      }
      return [...this.selected()];
    });
  }
}
