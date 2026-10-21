import katex from 'katex';
import { MathMarkup, Mounted, mountAsync } from 'pele/lazy';

export const pele = {
  mountAsync,
};

/**
 * Render LaTeX in a mermaid label with KaTeX.
 * Measured in the document so pele can lay out the label.
 */
export function mermaidMath(doc: Document): (tex: string, size: number) => MathMarkup | null {
  return (tex, size) => {
    const html = katex.renderToString(tex, { throwOnError: false });
    const measure = doc.createElement('div');
    measure.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;font-size:${size}px;line-height:normal;white-space:nowrap`;
    measure.innerHTML = html;
    doc.body.appendChild(measure);
    const { width, height } = measure.getBoundingClientRect();
    measure.remove();
    if (!width || !height) return null;
    return { html, width: Math.ceil(width), height: Math.ceil(height) };
  };
}

/**
 * Render a mermaid diagram into an element with pele.
 * @return cleanup function
 */
export function mountMermaid(el: HTMLElement, text: string): () => void {
  let destroyed = false;
  let mounted: Mounted | undefined;
  pele.mountAsync(el, text, { math: mermaidMath(el.ownerDocument) })
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
