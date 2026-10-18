import { mountAsync } from 'pele/lazy';

/**
 * Adapter exposing the subset of the mermaid global API used by ngx-markdown,
 * rendered with pele instead.
 */
export const peleMermaid = {
  initialize() { },
  run({ nodes }: { nodes: ArrayLike<HTMLElement> }) {
    for (const el of Array.from(nodes)) {
      const text = el.textContent || '';
      el.textContent = '';
      mountAsync(el, text).catch(err => console.error(err));
    }
  },
};

export function installMermaid() {
  (globalThis as any).mermaid ||= peleMermaid;
}
