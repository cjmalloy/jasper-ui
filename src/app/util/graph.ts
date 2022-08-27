import * as _ from 'lodash-es';
import { Ref } from '../model/ref';

export type GraphNode = Ref & {
  unloaded?: boolean,
  notFound?: boolean,
  pinned?: boolean,
  x?: number,
  y?: number,
  fx?: number,
  fy?: number,
};
export type GraphLink = {
  source: string | GraphNode,
  target: string | GraphNode,
};

export function links(...nodes: GraphNode[]) {
  return [
    ...nodes.flatMap(r => r.sources?.map(s => ({ target: s, source: r.url })) || []),
    ...nodes.flatMap(r => r.metadata?.responses?.map(s => ({ target: r.url, source: s })) || []),
    ...nodes.flatMap(r => r.metadata?.internalResponses?.map(s => ({ target: r.url, source: s })) || []),
  ];
}

export function references(nodes: GraphNode[]): string[] {
  return _.uniq([
    ...nodes.flatMap(r => r.sources || []),
    ...nodes.flatMap(r => r.metadata?.responses || []),
    ...nodes.flatMap(r => r.metadata?.internalResponses || []),
  ]);
}

export function unloadedReferences(allNodes: GraphNode[], ...nodes: GraphNode[]): string[] {
  return references(nodes).filter(s => !find(allNodes, s));
}

export function find(nodes: GraphNode[], url: string) {
  return _.find(nodes, r => r.url === url);
}
