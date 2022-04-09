import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3';
import * as _ from 'lodash';
import { catchError, throwError } from 'rxjs';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';

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
  depth?: number;
  @Input()
  tag = 'science';

  @Input()
  nodeStroke = '#d0d0d0';
  @Input()
  nodeStrokeWidth = 1.5;
  @Input()
  nodeStrokeOpacity = 1;
  @Input()
  nodeRadius = 5;
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
    // this.refs.page({ size: 100})
    // .subscribe(page => {
    //   this.content = page.content;
    //   this.draw();
    // })
    if (this.depth !== undefined) {
      for (let i = 0; i < this.depth; i++) this.loadMore();
    }
    this.draw();
  }

  loadMore() {
    const more = this.unloadedReferences(this.content).filter(s => !this.notFound.includes(s));
    if (!more.length) return;
    this.refs.list(more)
    .subscribe((moreLoaded: (Ref|null)[]) => {
      for (let i = 0; i < more.length; i++) {
        if (!moreLoaded[i]) {
          this.notFound.push(more[i]);
        }
      }
      this.content = [...this.content, ...<Ref[]>moreLoaded.filter(r => !!r)];
      this.draw();
    })
  }

  color(ref: GraphNode) {
    if (ref.notFound) return '#e54a4a';
    if (!ref.loaded) return '#e38a35';
    if (!ref.tags) return '#857979';
    if (ref.tags.includes('plugin/comment')) return '#4a8de5';
    if (!ref.title || ref.tags.includes('internal')) return '#fc91f5';
    if (ref.id.startsWith('comment:')) return '#4ae552';
    // if (ref.tags.includes(this.tag)) return '#e54a4a';
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
    const nodes = [
      ...this.content.map(s => ({ ...s, id: s.url, loaded: true })),
      ...this.unloadedReferences(this.content).map(s => ({ id: s, notFound: this.notFound.includes(s) })),
    ];
    const links = [
      ...this.content.flatMap(r => this.references([r]).map(s => ({source: r.url, target: s})) || []),
    ];

    const forceNode = d3.forceManyBody();
    const forceLink = d3.forceLink(links as unknown as SimulationLinkDatum<SimulationNodeDatum>[]).id(node => nodes[node.index!].id);
    if (this.nodeStrength !== undefined) forceNode.strength(this.nodeStrength);
    if (this.linkStrength !== undefined) forceLink.strength(this.linkStrength);

    const simulation = d3.forceSimulation(nodes as SimulationNodeDatum[])
      .force('link', forceLink)
      .force('charge', forceNode)
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

    const node = svg.append('g')
      .attr('stroke', this.nodeStroke)
      .attr('stroke-opacity', this.nodeStrokeOpacity)
      .attr('stroke-width', this.nodeStrokeWidth)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
      .attr('r', this.nodeRadius)
      .call(drag(simulation) as any)
      .on('click', event => this.clickNode(event));

    node.attr('fill', node => this.color(node));
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
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  }


}
