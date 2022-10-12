import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import * as d3 from 'd3';
import { ForceLink, ScaleTime, Selection, Simulation, SimulationNodeDatum } from 'd3';
import * as _ from 'lodash-es';
import { autorun, IReactionDisposer, runInAction, toJS } from 'mobx';
import * as moment from 'moment';
import { Observable, of, Subscription } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Ref, RefFilter } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';
import { isTextPost } from '../../../util/format';
import { find, GraphNode, isGraphable, isInternal, responses, sources } from '../../../util/graph';
import { Point, Rect } from '../../../util/math';
import { capturesAny, hasTag } from '../../../util/tag';

@Component({
  selector: 'app-force-directed',
  templateUrl: './force-directed.component.html',
  styleUrls: ['./force-directed.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForceDirectedComponent implements AfterViewInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];

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
  nodeRadius = 8;
  @Input()
  nodeStrength?: number;
  @Input()
  linkStroke = '#cbcbcb';
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

  constructor(
    public store: Store,
    private refs: RefService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
  ) {
    this.disposers.push(autorun(() => {
      this.selectedStroke = store.darkTheme ? this.selectedStrokeDarkTheme : this.selectedStrokeLightTheme;
      this.update();
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.store.graph.set([]);
  }

  @Input()
  set content(refs: Ref[]) {
    this.store.graph.set(refs.map(r => toJS(r)));
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
  }

  ngAfterViewInit(): void {
    this.init();
    this.update();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.update();
  }

  @HostListener('window:click', ['$event'])
  onWindowClick() {
    this.close();
  }

  load$(more: string[]) {
    if (!more.length) return of([]);
    return this.refs.list(more).pipe(
      tap((moreLoaded: (Ref|null)[]) => {
        for (let i = 0; i < more.length; i++) {
          if (!moreLoaded[i]) {
            this.store.graph.notFound(more[i]);
          }
        }
        this.store.graph.load(...moreLoaded.filter(n => !!n) as Ref[]);
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
    return find(this.store.graph.nodes, url);
  }

  max(loadCount: number) {
    return loadCount > this.maxLoad ? `(max ${this.maxLoad})` : `(${loadCount})`;
  }

  countRefUnloaded(ref: Ref) {
    const refs = this.store.graph.grabNodeOrSelection(ref);
    return refs.filter(r => r.unloaded).length;
  }

  countUnloadedSource(ref: Ref) {
    return this.countUnloaded(...sources(...this.store.graph.grabNodeOrSelection(ref)));
  }

  countUnloadedResponse(ref: Ref) {
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
    this.store.graph.select(..._.filter(this.store.graph.nodes, n => Rect.contains(rect, n as Point)));
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
    runInAction(() => this.store.graph.timeline = !this.store.graph.timeline);
    this.close();
  }

  toggleArrows() {
    runInAction(() => this.store.graph.arrows = !this.store.graph.arrows);
    this.close();
  }

  fullscreen() {
    if (window.innerHeight == screen.height) {
      document.exitFullscreen();
    } else {
      this.figure.nativeElement.requestFullscreen();
    }
    this.close();
  }

  title(ref: GraphNode) {
    return ref.title || ref.url;
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

  init() {
    const viewBox = [-this.figWidth / 2, -this.figHeight / 2, this.figWidth, this.figHeight];
    this.svg = d3.select('figure#force-directed-graph').append('svg')
      .attr('width', this.figWidth)
      .attr('height', this.figHeight)
      .attr('viewBox', viewBox)
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
      .attr('stroke', this.linkStroke)
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
        return this.timelineScale!((d as Ref).published!.valueOf());
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
          .selectAll('circle')
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
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
            x1: event.x + viewBox[0],
            y1: event.y + viewBox[1],
            x2: event.x + viewBox[0],
            y2: event.y + viewBox[1],
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
          rect.x2 = event.x + viewBox[0];
          rect.y2 = event.y + viewBox[1];
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
      .attr('viewBox', [-this.figWidth / 2, -this.figHeight / 2, this.figWidth, this.figHeight])

    this.link
      .selectAll('line')
      .data(this.store.graph.links)
      .join('line')
      .attr('marker-end', this.store.graph.arrows ? 'url(#arrow)' : null);

    const self = this;
    this.node
      .selectAll('circle')
      .data(this.store.graph.nodes, (d: any) => d.url)
      .join(
        enter => {
          const circle = enter.append('circle')
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
          return circle;
        },
        update => {
          update.select('title')
            .text(ref => this.title(ref));
          return update
            .attr('stroke', ref => this.store.graph.selected.includes(ref) ? this.selectedStroke : this.nodeStroke)
            .attr('stroke-dasharray', ref => this.store.graph.selected.includes(ref) ? this.selectedStrokeDashedArray : this.nodeStrokeDashedArray)
            .attr('stroke-opacity', ref => this.store.graph.selected.includes(ref) ? this.selectedStrokeOpacity : this.nodeStrokeOpacity)
            .attr('stroke-width', ref => this.store.graph.selected.includes(ref) ? this.selectedStrokeWidth : this.nodeStrokeOpacity)
            .attr('fill', ref => this.color(ref));
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
      const minDiff = moment.duration(1, 'day').asMilliseconds();
      if (this.store.graph.publishedDiff < minDiff) {
        const half = moment((minPublished || maxPublished || moment()).valueOf() / 2 + (maxPublished || minPublished || moment()).valueOf() / 2);
        minPublished = moment(half).subtract(minDiff / 2);
        maxPublished = moment(half).add(minDiff / 2);
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
