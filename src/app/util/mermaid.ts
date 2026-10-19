import { Mounted, mountAsync } from 'pele/lazy';

export const pele = {
  mountAsync,
};

/**
 * Render a mermaid diagram into an element with pele.
 * @return cleanup function
 */
export function mountMermaid(el: HTMLElement, text: string): () => void {
  let destroyed = false;
  let mounted: Mounted | undefined;
  pele.mountAsync(el, text)
    .then(m => {
      mounted = m;
      if (destroyed) m.destroy();
    })
    .catch(err => console.error(err));
  return () => {
    destroyed = true;
    mounted?.destroy();
  };
}
