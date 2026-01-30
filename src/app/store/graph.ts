import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { assign, difference, max, min, pullAll, remove } from 'lodash-es';
import { DateTime } from 'luxon';
import { Page } from '../model/page';
import { RefNode } from '../model/ref';
import { findNode, graphable, GraphLink, GraphNode, links, linkSources, unloadedReferences } from '../util/graph';

export class GraphStore {

  private _selected = signal<GraphNode[]>([]);
  private _nodes = signal<GraphNode[]>([]);
  private _links = signal<GraphLink[]>([]);
  private _loading = signal<string[]>([]);
  private _timeline = signal(true);
  private _arrows = signal(false);
  private _showUnloaded = signal(true);

  constructor(
    private router: Router,
  ) {}

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
    return this._nodes().filter(n => n.unloaded).map(n => n.url);
  }

  get graphable(): GraphNode[] {
    return graphable(...this._nodes());
  }

  get unloadedNotLoading(): string[] {
    return difference(this.unloaded, this._loading());
  }

  get selectedPage() {
    return Page.of(this._selected().filter(s => !s.unloaded));
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
    this._loading.set([]);
    this._nodes.set([...refs]);
    this._selected.set([...refs]);
    if (this._showUnloaded()) {
      this._nodes.update(nodes => [...nodes, ...unloadedReferences(nodes, ...refs).map(url => ({ url, unloaded: true }))]);
    }
    this._links.set(links(this._nodes(), ...this._nodes()));
  }

  load(...refs: RefNode[]) {
    const currentNodes = [...this._nodes()];
    for (const ref of refs) {
      const found = findNode(currentNodes, ref.url);
      if (found) {
        assign(found, ref);
        found.unloaded = false;
      } else {
        currentNodes.push(ref);
      }
    }
    if (this._showUnloaded()) {
      currentNodes.push(...difference(unloadedReferences(currentNodes, ...refs), this.unloaded).map(url => ({ url, unloaded: true })));
    }
    const currentLinks = [...this._links()];
    currentLinks.push(...links(currentNodes, ...refs));

    // Trigger updates
    this._nodes.set(currentNodes);
    this._selected.set([...this._selected()]);
    this._links.set(currentLinks);
    this._loading.update(loading => loading.filter(url => !refs.find(r => r.url === url)));
  }

  remove(refs: RefNode[]) {
    const currentNodes = [...this._nodes()];
    const currentSelected = [...this._selected()];
    const currentLinks = [...this._links()];

    pullAll(currentNodes, refs);
    pullAll(currentSelected, refs);
    for (const ref of refs) {
      remove(currentLinks, l => l.target === ref || l.source === ref);
    }

    this._nodes.set(currentNodes);
    this._selected.set(currentSelected);
    this._links.set(currentLinks);
  }

  toggleShowUnloaded() {
    this._showUnloaded.update(v => !v);
    const currentNodes = [...this._nodes()];
    if (this._showUnloaded()) {
      currentNodes.push(...unloadedReferences(currentNodes, ...currentNodes).map(url => ({ url, unloaded: true })));
    } else {
      remove(currentNodes, n => n.unloaded);
    }
    this._nodes.set(currentNodes);
    this._links.set(links(currentNodes, ...currentNodes));
  }

  select(...refs: GraphNode[]) {
    this._selected.set([...refs]);
  }

  selectAll() {
    this._selected.set([...this._nodes()]);
  }

  clearSelection() {
    this._selected.set([]);
  }

  getLoading(number: number) {
    if (this.unloadedNotLoading.length === 0) return [];
    const more = this.unloadedNotLoading.slice(0, number);
    this._loading.update(loading => [...loading, ...more]);
    return more;
  }

  startLoading(...url: string[]) {
    this._loading.update(loading => [...loading, ...url]);
  }

  notFound(url: string) {
    const currentNodes = [...this._nodes()];
    let ref = findNode(currentNodes, url);
    if (!ref) {
      ref = { url, notFound: true };
      currentNodes.push(ref);
    }
    ref.notFound = true;
    ref.unloaded = false;

    this._loading.update(loading => loading.filter(u => u !== url));

    const currentLinks = [...this._links()];
    if (!this._showUnloaded()) {
      currentLinks.push(...linkSources(currentNodes, url));
    }

    this._nodes.set(currentNodes);
    this._links.set(currentLinks);
    this._selected.set([...this._selected()]);
    return ref;
  }

  grabNodeOrSelection(ref: RefNode) {
    if (!this._selected().includes(ref)) {
      this._selected.set([ref]);
    }
    return [...this._selected()];
  }
}
