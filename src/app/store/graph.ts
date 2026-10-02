import { computed, signal, untracked } from '@angular/core';
import { assign, difference, max, min, without } from 'lodash-es';
import { DateTime } from 'luxon';
import { Page } from '../model/page';
import { RefNode } from '../model/ref';
import { findNode, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';
import { RouterStore } from './router';

export class GraphStore {

  private readonly _selected = signal<GraphNode[]>([]);
  private readonly _nodes = signal<GraphNode[]>([]);
  private readonly _links = signal<GraphLink[]>([]);
  private readonly _loading = signal<string[]>([]);
  private readonly _timeline = signal(true);
  private readonly _arrows = signal(false);
  private readonly _showUnloaded = signal(true);

  private readonly _unloaded = computed(() => this.nodes.filter(n => n.unloaded).map(n => n.url));
  private readonly _graphable = computed(() => graphable(...this.nodes));
  private readonly _unloadedNotLoading = computed(() => difference(this.unloaded, this.loading));
  private readonly _selectedPage = computed(() => Page.of(this.selected.filter(s => !s.unloaded)));
  private readonly _minPublished = computed((): DateTime => min(this.graphable.map(r => r.published).filter(p => !!p)) || DateTime.now().minus({ day: 1 }));
  private readonly _maxPublished = computed((): DateTime => max(this.graphable.map(r => r.published).filter(p => !!p)) || DateTime.now());
  private readonly _publishedDiff = computed(() => this.maxPublished?.diff(this.minPublished).milliseconds || 0);

  constructor(
    public route: RouterStore,
  ) { }

  get selected() { return this._selected(); }
  set selected(value: GraphNode[]) { this._selected.set(value); }

  get nodes() { return this._nodes(); }
  set nodes(value: GraphNode[]) { this._nodes.set(value); }

  get links() { return this._links(); }
  set links(value: GraphLink[]) { this._links.set(value); }

  get loading() { return this._loading(); }
  set loading(value: string[]) { this._loading.set(value); }

  get timeline() { return this._timeline(); }
  set timeline(value: boolean) { this._timeline.set(value); }

  get arrows() { return this._arrows(); }
  set arrows(value: boolean) { this._arrows.set(value); }

  get showUnloaded() { return this._showUnloaded(); }
  set showUnloaded(value: boolean) { this._showUnloaded.set(value); }

  get unloaded(): string[] {
    return this._unloaded();
  }

  get graphable(): GraphNode[] {
    return this._graphable();
  }

  get unloadedNotLoading(): string[] {
    return this._unloadedNotLoading();
  }

  get selectedPage() {
    return this._selectedPage();
  }

  get minPublished(): DateTime {
    return this._minPublished();
  }

  get maxPublished(): DateTime {
    return this._maxPublished();
  }

  get publishedDiff() {
    return this._publishedDiff();
  }

  set(refs: RefNode[]) {
    untracked(() => {
      const nodes: GraphNode[] = [...refs];
      if (this.showUnloaded) {
        nodes.push(...unloadedReferences(nodes, ...refs).map(url => ({ url, unloaded: true })));
      }
      this.loading = [];
      this.nodes = nodes;
      this.selected = [...refs];
      this.links = links(nodes, ...nodes);
    });
  }

  load(...refs: RefNode[]) {
    untracked(() => {
      const nodes = [...this.nodes];
      for (const ref of refs) {
        const found = findNode(nodes, ref.url);
        if (found) {
          assign(found, ref);
          found.unloaded = false;
        } else {
          nodes.push(ref);
        }
      }
      if (this.showUnloaded) {
        const unloaded = nodes.filter(n => n.unloaded).map(n => n.url);
        nodes.push(...difference(unloadedReferences(nodes, ...refs), unloaded).map(url => ({ url, unloaded: true })));
      }
      this.nodes = nodes;
      this.selected = [...this.selected];
      this.links = [...this.links, ...links(nodes, ...refs)];
      this.loading = without(this.loading, ...refs.map(r => r.url));
    });
  }

  remove(refs: RefNode[]) {
    untracked(() => {
      this.nodes = without(this.nodes, ...refs);
      this.selected = without(this.selected, ...refs);
      this.links = this.links.filter(l => !refs.find(ref => l.target === ref || l.source === ref));
    });
  }

  toggleShowUnloaded() {
    untracked(() => {
      this.showUnloaded = !this.showUnloaded;
      let nodes = [...this.nodes];
      if (this.showUnloaded) {
        nodes.push(...unloadedReferences(nodes, ...nodes).map(url => ({ url, unloaded: true })));
      } else {
        nodes = nodes.filter(n => !n.unloaded);
      }
      this.nodes = nodes;
      this.links = links(nodes, ...nodes);
    });
  }

  select(...refs: GraphNode[]) {
    this.selected = [...refs];
  }

  selectAll() {
    this.selected = [...untracked(() => this.nodes)];
  }

  clearSelection() {
    this.selected = [];
  }

  getLoading(number: number) {
    return untracked(() => {
      if (this.unloadedNotLoading.length === 0) return [];
      const more = this.unloadedNotLoading.slice(0, number);
      this.loading = [...this.loading, ...more];
      return more;
    });
  }

  startLoading(...url: string[]) {
    this.loading = [...untracked(() => this.loading), ...url];
  }

  notFound(url: string) {
    return untracked(() => {
      const nodes = [...this.nodes];
      let ref = findNode(nodes, url);
      if (!ref) {
        ref = { url, notFound: true };
        nodes.push(ref);
      }
      ref.notFound = true;
      ref.unloaded = false;
      this.nodes = nodes;
      this.loading = without(this.loading, url);
      if (!this.showUnloaded) {
        this.links = [...this.links, ...linkSources(nodes, url)];
      }
      this.selected = [...this.selected];
      return ref;
    });
  }

  grabNodeOrSelection(ref: RefNode) {
    return untracked(() => {
      if (!this.selected.includes(ref)) {
        this.selected = [ref];
      }
      return [...this.selected];
    });
  }
}
