import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import * as d3 from 'd3';
import { ScaleTime, Selection, Simulation, SimulationNodeDatum } from 'd3';
import * as _ from 'lodash-es';
import { autorun, toJS } from 'mobx';
import * as moment from 'moment';
import { catchError, Observable, of, Subscription, throwError } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { Store } from '../../../store/store';
import { isTextPost } from '../../../util/format';
import { Point, Rect } from '../../../util/math';
import { capturesAny, hasTag } from '../../../util/tag';

type GraphNode = Ref & {
  unloaded?: boolean,
  notFound?: boolean,
  pinned?: boolean,
  x?: number,
  y?: number,
  fx?: number,
  fy?: number,
};
type GraphLink = {
  source: string | GraphNode,
  target: string | GraphNode,
};

@Component({
  selector: 'app-force-directed',
  templateUrl: './force-directed.component.html',
  styleUrls: ['./force-directed.component.scss']
})
export class ForceDirectedComponent implements AfterViewInit {

  @Input()
  filter?: string | null;
  @Input()
  depth = 0;
  @Input()
  tag?: string | null = 'science';

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

  nodes: GraphNode[] = [];
  links: GraphLink[] = [];
  selected: GraphNode[] = [];
  unloaded: string[] = [];
  timeline = false;
  arrows = false;

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

  constructor(
    private refs: RefService,
    private overlay: Overlay,
    private viewContainerRef: ViewContainerRef,
    private store: Store,
  ) {
    autorun(() => {
      this.selectedStroke = store.darkTheme ? this.selectedStrokeDarkTheme : this.selectedStrokeLightTheme;
      this.update();
    });
  }

  @Input()
  set content(refs: Ref[]) {
    refs = toJS(refs);
    this.selected = [...refs];
    this.nodes = [...refs];
    this.links = this.getLinks(...refs);
    this.unloaded = this.unloadedReferences(...this.nodes);
    this.nodes.push(...this.unloaded.map(url => ({ url, unloaded: true })));
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

  get loadMore$() {
    if (!this.unloaded.length) return of([]);
    const more = this.unloaded.splice(0, Math.min(this.unloaded.length, 30));
    return this.refs.list(more).pipe(
      tap((moreLoaded: (Ref|null)[]) => {
        for (let i = 0; i < more.length; i++) {
          const ref = this.find(more[i])!;
          if (!moreLoaded[i]) {
            ref.unloaded = false;
            ref.notFound = true;
          } else {
            _.assign(ref, moreLoaded[i]);
            ref.unloaded = false;
            this.links.push(...this.getLinks(ref));
            const moreUnloaded = this.unloadedReferences(ref);
            this.unloaded = this.unloaded.concat(moreUnloaded);
            this.nodes.push(...moreUnloaded.map(url => ({ url,  unloaded: true })));
          }
        }
      }),
    );
  }

  getLinks(...refs: Ref[]) {
    return [
      ...refs.flatMap(r => r.sources?.map(s => ({ target: s, source: r.url })) || []),
      ...refs.flatMap(r => r.metadata?.responses?.map(s => ({ target: r.url, source: s })) || []),
      ...refs.flatMap(r => r.metadata?.internalResponses?.map(s => ({ target: r.url, source: s })) || []),
    ];
  }

  references(list: GraphNode[]): string[] {
    return _.uniq([
      ...list.flatMap(r => r.sources || []),
      ...list.flatMap(r => r.metadata?.responses || []),
      ...list.flatMap(r => r.metadata?.internalResponses || []),
    ]);
  }

  unloadedReferences(...refs: GraphNode[]): string[] {
    return this.references(refs).filter(s => !this.find(s));
  }

  find(url: string) {
    return _.find(this.nodes, r => r.url === url);
  }

  drawMore() {
    this.loadMore$.subscribe(more => {
      if (more.length) {
        this.simulation?.alpha(0.1);
        this.update();
      }
    });
  }

  clickNode(ref: GraphNode, event: MouseEvent) {
    event.stopPropagation();
    const url = ref.url;
    this.selected = [ref];
    if (!ref.unloaded) {
      this.update();
      return;
    }
    ref.unloaded = false;
    _.remove(this.unloaded, url);
    this.refs.get(url).pipe(
      catchError(err => {
        ref.notFound = true;
        this.update();
        return throwError(() => err);
      }),
    )
    .subscribe(res => {
      Object.assign(ref, res);
      this.links.push(...this.getLinks(ref));
      const moreUnloaded = this.unloadedReferences(ref);
      this.unloaded.push(...moreUnloaded);
      this.nodes.push(...moreUnloaded.map(url => ({ url,  unloaded: true })));
      this.update();
    });
  }

  select(rect?: Rect) {
    this.selected = _.filter(this.nodes, n => Rect.contains(rect, n as Point));
    this.update();
  }

  contextMenu(ref: GraphNode | null, event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    this.close();
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
    if (!this.selected.includes(ref)) {
      this.selected = [ref];
    }
    this.selected.forEach(s => {
      s.pinned = ref.pinned;
      s.fx = s.pinned ? s.x ?? 0 : undefined;
      s.fy = s.pinned ? s.y ?? 0 : undefined;
    });
    this.close();
  }

  unload(ref: GraphNode) {
    this.simulation?.alpha(0.3);
    if (!this.selected.includes(ref)) {
      this.selected = [ref];
    }
    this.selected.forEach(ref => {
      _.remove(this.unloaded, ref.url);
      _.remove(this.nodes, ref);
      _.remove(this.links, l =>
        l.target === ref.url || (l.target as any).url === ref.url ||
        l.source === ref.url || (l.source as any).url === ref.url);
    });
    this.close();
  }

  restart(ref: GraphNode) {
    this.simulation?.alpha(0.3);
    if (!this.selected.includes(ref)) {
      this.selected = [ref];
    }
    this.content = [...this.selected];
    this.close();
  }

  toggleTimeline() {
    this.simulation?.alpha(0.5);
    this.timeline = !this.timeline;
    this.close();
  }

  toggleArrows() {
    this.arrows = !this.arrows;
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

    this.simulation = d3.forceSimulation()
      .force('charge', d3.forceManyBody().distanceMax(300))
      .force('x', d3.forceX(d => {
        if (!this.timeline) return 0;
        if (!(d as Ref).published) return 0;
        return this.timelineScale!((d as Ref).published!.valueOf());
      }).strength(d => {
        if (!this.timeline) return 0.1;
        if (!(d as Ref).published) return 0;
        return 0.1;
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
    if (!this.svg || !this.simulation ||!this.link || !this.node) return;

    this.svg
      .attr('width', this.figWidth)
      .attr('height', this.figHeight)
      .attr('viewBox', [-this.figWidth / 2, -this.figHeight / 2, this.figWidth, this.figHeight])

    this.link
      .selectAll('line')
      .data(this.links)
      .join('line')
      .attr('marker-end', this.arrows ? 'url(#arrow)' : null);

    const self = this;
    this.node
      .selectAll('circle')
      .data(this.nodes, (d: any) => d.url)
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
            .attr('stroke', ref => this.selected.includes(ref) ? this.selectedStroke : this.nodeStroke)
            .attr('stroke-dasharray', ref => this.selected.includes(ref) ? this.selectedStrokeDashedArray : this.nodeStrokeDashedArray)
            .attr('stroke-opacity', ref => this.selected.includes(ref) ? this.selectedStrokeOpacity : this.nodeStrokeOpacity)
            .attr('stroke-width', ref => this.selected.includes(ref) ? this.selectedStrokeWidth : this.nodeStrokeOpacity)
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

    if (this.timeline) {
      let minPublished = _.min(this.nodes.map(r => r.published).filter(p => !!p));
      let maxPublished = _.max(this.nodes.map(r => r.published).filter(p => !!p));
      const totalDiff = maxPublished?.diff(minPublished) || 0;
      const minDiff = moment.duration(1, 'day').asMilliseconds();
      if (totalDiff < minDiff) {
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
      .nodes(this.nodes as any)
      .force('link', d3.forceLink(this.links).id((l: any) => l.url))
      .restart();
  }

}
