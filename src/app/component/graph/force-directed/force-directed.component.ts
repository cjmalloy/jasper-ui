import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  Input,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import * as d3 from 'd3';
import { ForceLink, ScaleTime, Selection, Simulation, SimulationNodeDatum } from 'd3';
import { filter } from 'lodash-es';
import { DateTime, Duration } from 'luxon';

import { Observable, of, Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { HasChanges } from '../../../guard/pending-changes.guard';
import { Ref, RefNode } from '../../../model/ref';
import { active, sortOrder } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { GraphService } from '../../../service/api/graph.service';
import { Store } from '../../../store/store';
import { getTitle, isTextPost } from '../../../util/format';
import { findNode, GraphNode, isGraphable, isInternal, responses, sources } from '../../../util/graph';
import { getScheme } from '../../../util/http';
import { Point, Rect } from '../../../util/math';
import { capturesAny, hasTag } from '../../../util/tag';
import { LoadingComponent } from '../../loading/loading.component';
import { RefListComponent } from '../../ref/ref-list/ref-list.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-force-directed',
  templateUrl: './force-directed.component.html',
  styleUrls: ['./force-directed.component.scss'],
  imports: [
    forwardRef(() => RefListComponent),
    LoadingComponent,
  ],
})
export class ForceDirectedComponent implements AfterViewInit, OnDestroy, HasChanges {
  store = inject(Store);
  private admin = inject(AdminService);
  private graphs = inject(GraphService);
  private overlay = inject(Overlay);
  private viewContainerRef = inject(ViewContainerRef);


  @Input()
  filter?: string[];
  @Input()
  depth = 0;
  @Input()
  tag?: string | null = 'science';

  @Input()
  maxLoad = 30;
  @Input()
  nodeStroke = '#d0d0d0';
  @Input()
  nodeStrokeDashedArray = '';
  @Input()
  nodeStrokeWidth = 1.5;
  @Input()
  nodeStrokeOpacity = 1;
  @Input()
  selectedStrokeDarkTheme = '#f6f6f6';
  @Input()
  selectedStrokeLightTheme = '#101010';
  selectedStroke = this.selectedStrokeLightTheme;
  @Input()
  selectedStrokeWidth = 1.5;
  @Input()
  selectedStrokeDashedArray = '1.5,2';
  @Input()
  selectedStrokeOpacity = 1;
  @Input()
  nodeRadius = 10;
  @Input()
  nodeStrength?: number;
  @Input()
  linkStrokeLightTheme  = '#444444';
  @Input()
  linkStrokeDarkTheme  = '#cbcbcb';
  linkStroke = this.linkStrokeLightTheme ;
  @Input()
  linkStrokeOpacity = 0.6;
  @Input()
  linkStrokeWidth = 1.5;
  @Input()
  linkStrokeLinecap = 'round';
  @Input()
  linkStrength?: number;

  @ViewChild('figure')
  figure!: ElementRef;
  @ViewChild('nodeMenu')
  nodeMenu!: TemplateRef<any>;
  @ViewChild('list')
  list?: RefListComponent;

  overlayRef?: OverlayRef;
  sub?: Subscription;

  private simulation?: Simulation<SimulationNodeDatum, undefined>;
  private node?: Selection<any, any, any, any>;
  private link?: Selection<any, any, any, any>;
  private svg?: Selection<any, unknown, HTMLElement, any>;
  private yAxis?: Selection<any, any, any, any>;
  private timelineScale?: ScaleTime<number, number, never>;
  private dragRect?: Selection<any, unknown, any, any>;
  private forceLink?: ForceLink<SimulationNodeDatum, any>;

  constructor() {
    const store = this.store;

    effect(() => {
      this.selectedStroke = store.darkTheme ? this.selectedStrokeDarkTheme : this.selectedStrokeLightTheme;
      this.linkStroke = store.darkTheme ? this.linkStrokeDarkTheme : this.linkStrokeLightTheme;
      this.update();
    });
  }

  saveChanges() {
    return !this.list || this.list.saveChanges();
  }

  ngOnDestroy() {
    this.store.graph.set([]);
  }

  @Input()
  set content(refs: Ref[]) {
    this.graphs.list(refs.map(r => r.url))
      .subscribe(nodes => {
        this.store.graph.set(nodes.filter(n => !!n) as RefNode[]);
        if (this.depth > 0) {
          let init: Observable<any> = of(1);
          for (let i = 0; i< this.depth; i++) {
            init = init.pipe(switchMap(() => this.loadMore$));
          }
          init.subscribe(() => {
            if (this.figure) {
              this.update()
            }
          });
        } else if (this.figure) {
          this.update();
        }
      });
  }

  ngAfterViewInit(): void {
    this.init();
    this.update();
  }

  @HostListener('window:resize')
  onResize() {
    this.simulation?.alpha(0.3);
    this.update();
  }

  @HostListener('window:click')
  onWindowClick() {
    this.close();
  }

  load$(more: string[]) {
    if (!more.length) return of([]);
    return this.graphs.list(more).pipe(
      tap((moreLoaded: (RefNode|null)[]) => {
        for (let i = 0; i < more.length; i++) {
          if (!moreLoaded[i]) {
            this.store.graph.notFound(more[i]);
          }
        }
        this.store.graph.load(...moreLoaded.filter(n => !!n) as RefNode[]);
      }),
    );
  }

  get loadMore$() {
    return this.load$(this.store.graph.getLoading(this.maxLoad));
  }

  drawMore() {
    this.loadMore$.subscribe(more => {
      if (more.length) {
        this.simulation?.alpha(0.1);
        this.update();
      }
    });
  }

  find(url: string) {
    return findNode(this.store.graph.nodes, url);
  }

  max(loadCount: number) {
    return loadCount > this.maxLoad ? `(max ${this.maxLoad})` : `(${loadCount})`;
  }

  countRefUnloaded(ref: RefNode) {
    const refs = this.store.graph.grabNodeOrSelection(ref);
    return refs.filter(r => r.unloaded).length;
  }

  countUnloadedSource(ref: RefNode) {
    return this.countUnloaded(...sources(...this.store.graph.grabNodeOrSelection(ref)));
  }

  countUnloadedResponse(ref: RefNode) {
    return this.countUnloaded(...responses(...this.store.graph.grabNodeOrSelection(ref)));
  }

  countUnloaded(...urls: string[]) {
    return urls.filter((url: string) => {
      const r = this.find(url);
      return !r || r.unloaded;
    }).length;
  }

  clickNode(ref: GraphNode, event?: MouseEvent) {
    event?.stopPropagation();
    this.store.graph.select(ref);
    if (ref.unloaded) {
      this.load(ref);
    } else {
      this.update();
    }
  }

  select(rect?: Rect) {
    this.store.graph.select(...filter(this.store.graph.nodes, n => Rect.contains(rect, n as Point)));
    this.update();
  }

  contextMenu(ref: GraphNode | null, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.close();
    if (ref && !this.store.graph.selected.includes(ref)) {
      this.store.graph.select(ref);
    }
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo({x: event.x, y: event.y})
      .withPositions([{
        originX: 'center',
        originY: 'center',
        overlayX: 'start',
        overlayY: 'top',
      }]);
    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.close()
    });
    this.overlayRef.attach(new TemplatePortal(this.nodeMenu, this.viewContainerRef, {
      $implicit: ref
    }));
  }

  close() {
    if (!this.sub && !this.overlayRef) return;
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
    this.update();
  }

  selectAll() {
    this.store.graph.selectAll();
    this.close();
  }

  pin(ref: GraphNode) {
    ref.pinned = !ref.pinned;
    if (!ref.pinned) {
      this.simulation?.alpha(0.1);
    }
    this.store.graph.grabNodeOrSelection(ref).forEach(s => {
      s.pinned = ref.pinned;
      s.fx = s.pinned ? s.x ?? 0 : undefined;
      s.fy = s.pinned ? s.y ?? 0 : undefined;
    });
    this.close();
  }

  loadSources(ref: GraphNode) {
    this.load$(sources(...this.store.graph.grabNodeOrSelection(ref)).filter(url => !this.find(url)).slice(0, this.maxLoad)).subscribe(more => {
      if (more.length) {
        this.simulation?.alpha(0.1);
        this.update();
      }
    });
    this.close();
  }

  loadResponses(ref: GraphNode) {
    this.load$(responses(...this.store.graph.grabNodeOrSelection(ref)).filter(url => !this.find(url)).slice(0, this.maxLoad)).subscribe(more => {
      if (more.length) {
        this.simulation?.alpha(0.1);
        this.update();
      }
    });
    this.close();
  }

  load(ref: GraphNode) {
    const urls = this.store.graph.grabNodeOrSelection(ref).filter(r => r.unloaded).map(r => r.url).slice(0, this.maxLoad);
    this.store.graph.startLoading(...urls);
    this.load$(urls).subscribe(more => {
      if (more.length) {
        this.simulation?.alpha(0.1);
        this.update();
      }
    });
    this.close();
  }

  remove(ref: GraphNode) {
    this.simulation?.alpha(0.3);
    this.store.graph.remove(this.store.graph.grabNodeOrSelection(ref));
    this.close();
  }

  restart(ref: GraphNode) {
    this.simulation?.alpha(0.3);
    this.content = [...this.store.graph.grabNodeOrSelection(ref)];
    this.close();
  }

  toggleUnloaded() {
    this.simulation?.alpha(0.5);
    this.store.graph.toggleShowUnloaded();
    this.close();
  }

  toggleTimeline() {
    this.simulation?.alpha(0.5);
    this.store.graph.timeline = !this.store.graph.timeline;
    this.close();
  }

  toggleArrows() {
    this.store.graph.arrows = !this.store.graph.arrows;
    this.close();
  }

  fullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      this.figure.nativeElement.requestFullscreen();
    }
    this.close();
  }

  icon(ref: GraphNode) {
    return sortOrder(this.admin.getIcons(ref.tags, ref.plugins, getScheme(ref.url))).filter(i => active(ref, i)).shift()?.label || '';
  }

  color(ref: GraphNode) {
    if (ref.notFound) return '#e54a4a';
    if (ref.unloaded) return '#e38a35';
    if (hasTag('plugin/comment', ref)) return '#4a8de5';
    if (isTextPost(ref)) return '#4ae552';
    if (!ref.tags || !ref.title || hasTag('internal', ref)) return '#857979';
    if (this.tag && capturesAny([this.tag!], ref.tags)) return '#c34ae5';
    return '#1c378c';
  }

  get figWidth() {
    return this.figure.nativeElement.offsetWidth;
  }

  get figHeight() {
    return this.figure.nativeElement.offsetHeight;
  }

  get viewBox() {
    return [-this.figWidth / 2, -this.figHeight / 2, this.figWidth, this.figHeight]
  }

  init() {
    this.svg = d3.select('figure#force-directed-graph').append('svg')
      .attr('width', this.figWidth)
      .attr('height', this.figHeight)
      .attr('viewBox', this.viewBox)
      .attr('style', 'max-width: 100%; height: auto; height: intrinsic;')
      .call(dragSelection() as any);

    this.svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', -0.5)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', this.linkStroke)
      .attr('d', 'M0,-5L10,0L0,5');

    this.link = this.svg.append('g')
      .attr('stroke-opacity', this.linkStrokeOpacity)
      .attr('stroke-width', this.linkStrokeWidth)
      .attr('stroke-linecap', this.linkStrokeLinecap);

    this.node = this.svg.append('g');

    this.forceLink = d3.forceLink()
      .id((l: any) => l.url);
    const defaultStrength = this.forceLink.strength();
    this.forceLink.strength((l, i , links) => {
      const strength = defaultStrength.call(this, l, i, links);
      if (isInternal(l.source) || isInternal(l.target)) return strength * 0.1;
      return strength;
    })
    this.simulation = d3.forceSimulation()
      .force('link', this.forceLink)
      .force('charge', d3.forceManyBody().distanceMax(300))
      .force('x', d3.forceX(d => {
        if (!this.store.graph.timeline) return 0;
        if (!isGraphable(d as GraphNode)) return 0;
        return this.timelineScale!((d as RefNode).published!.valueOf());
      }).strength(d => {
        if (!this.store.graph.timeline) return 0.1;
        if (!isGraphable(d as GraphNode)) return 0;
        return 0.5;
      }))
      .force('y', d3.forceY())
      .on('tick', () => {
        this.link!
          .selectAll('line')
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        this.node!
          .selectAll('g').select('circle')
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
        this.node!
          .selectAll('g').select('text')
          .attr('x', (d: any) => d.x)
          .attr('y', (d: any) => d.y);
      });

    this.dragRect = this.svg.append('g')
      .append('rect')
      .style('display', 'none')
      .attr('fill', 'transparent')
      .attr('stroke', this.selectedStroke)
      .attr('stroke-dasharray', this.selectedStrokeDashedArray)
      .attr('stroke-opacity', this.selectedStrokeOpacity)
      .attr('stroke-width', this.selectedStrokeWidth);

    const self = this;
    function dragSelection() {
      let rect: Rect;
      return d3.drag()
        .on('start', event => {
          rect = {
            x1: event.x - self.figWidth / 2,
            y1: event.y - self.figHeight / 2,
            x2: event.x - self.figWidth / 2,
            y2: event.y - self.figHeight / 2,
          };
          self.dragRect!
            .style('display', 'inline')
            .attr('stroke', self.selectedStroke)
            .attr('x', Math.min(rect.x1, rect.x2))
            .attr('y', Math.min(rect.y1, rect.y2))
            .attr('width', Math.abs(rect.x1 - rect.x2))
            .attr('height', Math.abs(rect.y1 - rect.y2));
        })
        .on('drag', event => {
          rect.x2 = event.x - self.figWidth / 2;
          rect.y2 = event.y - self.figHeight / 2;
          self.dragRect!
            .attr('x', Math.min(rect.x1, rect.x2))
            .attr('y', Math.min(rect.y1, rect.y2))
            .attr('width', Math.abs(rect.x1 - rect.x2))
            .attr('height', Math.abs(rect.y1 - rect.y2));
        })
        .on('end', event => {
          self.select(rect);
          self.dragRect!
            .style('display', 'none');
        });
    }
  }

  update() {
    if (!this.svg || !this.simulation || !this.link || !this.node) return;

    this.svg
      .attr('width', this.figWidth)
      .attr('height', this.figHeight)
      .attr('viewBox', this.viewBox)

    this.link
      .selectAll('line')
      .data(this.store.graph.links)
      .join('line')
      .attr('stroke', () => this.linkStroke)
      .attr('marker-end', this.store.graph.arrows ? 'url(#arrow)' : null);

    const self = this;
    this.node
      .selectAll('g')
      .data(this.store.graph.nodes, (d: any) => d.url)
      .join(
        enter => {
          const node = enter.append('g');
          const circle = node.append('circle')
            .attr('r', this.nodeRadius)
            .attr('fill', ref => this.color(ref))
            .attr('stroke', this.nodeStroke)
            .attr('stroke-opacity', this.nodeStrokeOpacity)
            .attr('stroke-width', this.nodeStrokeWidth)
            .call(drag(this.simulation!) as any)
            .on('click', function(event) {
              self.clickNode((this as any).__data__, event);
            })
            .on('contextmenu', function(event) {
              self.contextMenu((this as any).__data__, event);
            });
          circle.append('title');
          node.append('text')
            .attr('font-size', '14px')
            .attr('pointer-events', 'none')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'central');
          return node;
        },
        update => {
          update.select('circle')
            .attr('stroke', ref => this.store.graph.selected.includes(ref) ? this.selectedStroke : this.nodeStroke)
            .attr('stroke-dasharray', ref => this.store.graph.selected.includes(ref) ? this.selectedStrokeDashedArray : this.nodeStrokeDashedArray)
            .attr('stroke-opacity', ref => this.store.graph.selected.includes(ref) ? this.selectedStrokeOpacity : this.nodeStrokeOpacity)
            .attr('stroke-width', ref => this.store.graph.selected.includes(ref) ? this.selectedStrokeWidth : this.nodeStrokeOpacity)
            .attr('fill', ref => this.color(ref))
            .select('title')
            .text(ref => getTitle(ref));
          update.select('text')
            .text(ref => this.icon(ref));
          return update;
        });

    function drag(simulation: Simulation<SimulationNodeDatum, undefined>) {
      return d3.drag()
        .on('start', event => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        })
        .on('drag', event => {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        })
        .on('end', event => {
          if (!event.active) simulation.alphaTarget(0);
          if (!event.subject.pinned) {
            event.subject.fx = null;
            event.subject.fy = null;
          }
        });
    }

    if (this.store.graph.timeline) {
      let minPublished = this.store.graph.minPublished;
      let maxPublished = this.store.graph.maxPublished;
      const minDiff = Duration.fromObject({ day: 1 }).milliseconds;
      if (this.store.graph.publishedDiff < minDiff) {
        const half = DateTime.fromMillis((minPublished || maxPublished || DateTime.now()).valueOf() / 2 + (maxPublished || minPublished || DateTime.now()).valueOf() / 2);
        minPublished = half.minus(minDiff / 2);
        maxPublished = half.plus(minDiff / 2);
      }
      const height = 20;
      const padding = 40;
      this.timelineScale = d3
        .scaleTime()
        .domain([minPublished!.valueOf(), maxPublished!.valueOf()])
        .range([-this.figWidth / 2 + padding, this.figWidth / 2 - padding])
        .nice();
      this.yAxis ??= this.svg.append('g');
      this.yAxis
        .attr('transform', 'translate(0, ' + (this.figHeight / 2 - height) + ')')
        .call(d3.axisBottom(this.timelineScale));
    } else {
      this.yAxis?.remove();
      this.yAxis = undefined;
    }

    this.simulation
      .nodes(this.store.graph.nodes as any)
      .force('link', this.forceLink!.links(this.store.graph.links))
      .restart();
  }

}
