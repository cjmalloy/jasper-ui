import { filter, find, uniq } from 'lodash-es';
import { RefNode } from '../model/ref';
import { hasTag } from './tag';

export type GraphNode = RefNode & {
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

export function graphable(...nodes: GraphNode[]) {
  return nodes.filter(n => isGraphable(n));
}

export function isGraphable(node: GraphNode) {
  return node.published && !isInternal(node);
}

export function isInternal(node: GraphNode) {
  return hasTag('internal', node);
}

export function links(allNodes: GraphNode[], ...nodes: GraphNode[]) {
  return [
    ...nodes.flatMap(n => sources(n).filter(url => findNode(allNodes, url)).map(url => ({ source: url, target: n.url })) || []),
    ...nodes.flatMap(n => responses(n).filter(url => findNode(allNodes, url)).map(url => ({ source: n.url, target: url })) || []),
  ];
}

export function linkSources(allNodes: GraphNode[], url: string) {
  return filter(allNodes, n => !!n.sources?.includes(url)).map((n: GraphNode) => ({ source: url, target: n.url }));
}

export function references(...nodes: GraphNode[]): string[] {
  return uniq([...sources(...nodes), ...responses(...nodes)]);
}

export function sources(...nodes: GraphNode[]): string[] {
  return nodes.flatMap(r => r.sources || []);
}

export function responses(...nodes: GraphNode[]): string[] {
  return nodes.flatMap(r => r.responses || []);
}

export function unloadedReferences(allNodes: GraphNode[], ...nodes: GraphNode[]): string[] {
  return references(...graphable(...nodes)).filter(s => !findNode(allNodes, s));
}

export function findNode(nodes: GraphNode[], url: string) {
  return find(nodes, r => r.url === url);
}
