import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import { Simulation, SimulationNodeDatum } from 'd3';
import * as _ from 'lodash';
import { catchError, Observable, of, throwError } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';
import { capturesAny } from '../../../util/tag';

type GraphNode = { id: string, loaded?: boolean, notFound?: boolean, tags?: string[], title?: string };
type GraphLink = { source: string, target: string };

@Component({
  selector: 'app-force-directed',
  templateUrl: './force-directed.component.html',
  styleUrls: ['./force-directed.component.scss']
})
export class ForceDirectedComponent implements OnInit, AfterViewInit {

  @Input()
  content!: Ref[];
  @Input()
  filter?: string | null;
  @Input()
  depth = 0;
  @Input()
  tag?: string | null = 'science';

  @Input()
  nodeStroke = '#d0d0d0';
  @Input()
  nodeStrokeWidth = 1.5;
  @Input()
  nodeStrokeOpacity = 1;
  @Input()
  selectedStroke = '#e15c46';
  @Input()
  selectedStrokeWidth = 3;
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

  selected?: Ref;
  selectedNotFound?: string;
  notFound: string[] = [];

  @ViewChild('figure')
  figure!: ElementRef;

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.selected = this.content[0];
  }

  ngAfterViewInit(): void {
    if (this.depth > 0) {
      let init: Observable<any> = of(1);
      for (let i = 0; i< this.depth; i++) {
        init = init.pipe(mergeMap(() => this.loadMore$));
      }
      init.subscribe(() => this.draw());
    } else {
      this.draw();
    }
  }

  get loadMore$() {
    return of(1).pipe(
      mergeMap(() => of(this.unloadedReferences(this.content).filter(s => !this.notFound.includes(s)))),
      mergeMap(more => !more.length ? of([]) : this.refs.list(more).pipe(
        tap((moreLoaded: (Ref|null)[]) => {
          for (let i = 0; i < more.length; i++) {
            if (!moreLoaded[i]) {
              this.notFound.push(more[i]);
            }
          }
          this.content = [...this.content, ...<Ref[]>moreLoaded.filter(r => !!r)];
        }),
      )),
    );
  }

  drawMore() {
    this.loadMore$.subscribe(more => {
      if (more.length) this.draw();
    });
  }

  color(ref: GraphNode) {
    if (ref.notFound) return '#e54a4a';
    if (!ref.loaded) return '#e38a35';
    if (ref.tags?.includes('plugin/comment')) return '#4a8de5';
    if (ref.id.startsWith('comment:')) return '#4ae552';
    if (!ref.tags || !ref.title || ref.tags.includes('internal')) return '#857979';
    if (this.tag && capturesAny([this.tag!], ref.tags)) return '#c34ae5';
    return '#1c378c';
  }

  title(ref: GraphNode) {
    return ref.title || ref.id;
  }

  contains(url: string): boolean {
    return !!_.find(this.content, r => r.url === url);
  }

  references(list: Ref[]): string[] {
    return _.uniq([
      ...list.flatMap(r => r.sources || []),
      ...list.flatMap(r => r.metadata?.responses || []),
      ...list.flatMap(r => r.metadata?.internalResponses || []),
    ]);
  }

  unloadedReferences(list: Ref[]): string[] {
    return this.references(list).filter(s => !this.contains(s));
  }

  clickNode(event: PointerEvent) {
    const url = (event.target as any).__data__.id;
    if (this.notFound.includes(url)) {
      this.selectedNotFound = url;
      this.selected = undefined;
    }
    this.refs.get(url).pipe(
      catchError(err => {
        this.notFound.push(url);
        this.selectedNotFound = url;
        return throwError(() => err);
      }),
    )
    .subscribe(ref => {
      this.selected = ref;
      if (!this.contains(url)) {
        this.content.push(ref);
        this.draw();
      }
    });
  }

  get figWidth() {
    return this.figure.nativeElement.offsetWidth;
  }

  get figHeight() {
    return this.figure.nativeElement.offsetHeight;
  }

  draw() {
    this.figure.nativeElement.innerHTML = '';
    const nodes: GraphNode[] = [
      ...this.content.map((s: any) => {
        s.id = s.url;
        s.loaded = true;
        return s;
      }),
      ...this.unloadedReferences(this.content).map(s => ({ id: s, notFound: this.notFound.includes(s) })),
    ];
    const links: GraphLink[] = [
      ...this.content.flatMap(r => this.references([r]).map(s => ({ source: r.url, target: s })) || []),
    ];

    const simulation = d3.forceSimulation(nodes as SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id(node => (node as GraphNode).id))
      .force('charge', d3.forceManyBody())
      .force('x', d3.forceX())
      .force('y', d3.forceY())
      .on('tick', () => {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node
          .attr('cx', (d: any) => d.x)
          .attr('cy', (d: any) => d.y);
      });

    const svg = d3.select('figure#force-directed-graph').append('svg')
      .attr('width', this.figWidth)
      .attr('height', this.figHeight)
      .attr('viewBox', [-this.figWidth / 2, -this.figHeight / 2, this.figWidth, this.figHeight])
      .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');

    const link = svg.append('g')
      .attr('stroke', this.linkStroke)
      .attr('stroke-opacity', this.linkStrokeOpacity)
      .attr('stroke-width', this.linkStrokeWidth)
      .attr('stroke-linecap', this.linkStrokeLinecap)
    .selectAll('line')
    .data(links)
    .join('line');

    const self = this;
    const node = svg.append('g')
      .attr('stroke', this.nodeStroke)
      .attr('stroke-opacity', this.nodeStrokeOpacity)
      .attr('stroke-width', this.nodeStrokeWidth)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
      .attr('r', this.nodeRadius)
      .attr('fill', node => this.color(node))
      .call(drag(simulation) as any)
      .on('click', function(event) {
        d3.selectAll('circle')
          .attr('stroke', self.nodeStroke)
          .attr('stroke-opacity', self.nodeStrokeOpacity)
          .attr('stroke-width', self.nodeStrokeWidth)
        d3.select(this)
          .attr('stroke', self.selectedStroke)
          .attr('stroke-opacity', self.selectedStrokeOpacity)
          .attr('stroke-width', self.selectedStrokeWidth)
        self.clickNode(event);
      });

    node.append('title').text(node => this.title(node));

    function drag(simulation: Simulation<SimulationNodeDatum, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  }


}
