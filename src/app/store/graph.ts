import { computed, Injectable, signal } from '@angular/core';
import { assign, difference, max, min, pull, pullAll, remove } from 'lodash-es';
import { DateTime } from 'luxon';
import { RouterStore } from 'mobx-angular';
import { Page } from '../model/page';
import { RefNode } from '../model/ref';
import { findNode, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';

@Injectable({
  providedIn: 'root'
})
export class GraphStore {

  private _selected = signal<GraphNode[]>([]);
  private _nodes = signal<GraphNode[]>([]);
  private _links = signal<GraphLink[]>([]);
  private _loading = signal<string[]>([]);
  private _timeline = signal(true);
  private _arrows = signal(false);
  private _showUnloaded = signal(true);

  // Backwards compatible getters/setters
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

  // New signal-based API
  selected$ = computed(() => this._selected());
  nodes$ = computed(() => this._nodes());
  links$ = computed(() => this._links());
  loading$ = computed(() => this._loading());
  timeline$ = computed(() => this._timeline());
  arrows$ = computed(() => this._arrows());
  showUnloaded$ = computed(() => this._showUnloaded());

  constructor(
    public route: RouterStore,
  ) {
    // No initialization needed with signals
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

  get minPublished(): DateTime {
    return min(this.graphable.map(r => r.published).filter(p => !!p)) || DateTime.now().minus({ day: 1 });
  }

  get maxPublished(): DateTime {
    return max(this.graphable.map(r => r.published).filter(p => !!p)) || DateTime.now();
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

