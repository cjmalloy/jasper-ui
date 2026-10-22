/// <reference types="vitest/globals" />
import { mermaidMath } from './mermaid';

describe('mermaidMath', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should render KaTeX html with measured size', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 20.2, height: 10.5 } as DOMRect);
    const result = mermaidMath(document)('x^2', 16);
    expect(result).toEqual({ html: expect.stringContaining('katex'), width: 21, height: 11 });
    expect(document.body.children.length).toBe(0);
  });

  it('should fall back to text when unmeasurable', () => {
    expect(mermaidMath(document)('x^2', 16)).toBeNull();
  });
});
