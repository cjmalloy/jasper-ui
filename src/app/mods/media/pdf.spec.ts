import { describe, expect, it } from 'vitest';
import { Ref } from '../../model/ref';
import { pdfEmbedUrl, pdfPlugin } from './pdf';

describe('pdfEmbedUrl', () => {
  const proxyOff = { ...pdfPlugin, config: { ...pdfPlugin.config, proxy: false } };
  const ref = (url: string, pdf?: string): Ref => ({
    url,
    origin: '',
    tags: ['plugin/pdf'],
    plugins: pdf ? { 'plugin/pdf': { url: pdf } } : {},
  });

  it('embeds PDFs through the proxy', () => {
    expect(pdfEmbedUrl(pdfPlugin, ref('https://example.com/paper.pdf'))).toBe('https://example.com/paper.pdf');
    expect(pdfEmbedUrl(pdfPlugin, ref('comment:1', 'cache:abc'))).toBe('cache:abc');
  });

  it('only embeds cached PDFs without the proxy', () => {
    expect(pdfEmbedUrl(proxyOff, ref('https://example.com/paper.pdf'))).toBeUndefined();
    expect(pdfEmbedUrl(proxyOff, ref('comment:1', 'cache:abc'))).toBe('cache:abc');
  });

  it('never embeds data: URLs, which are not proxied', () => {
    expect(pdfEmbedUrl(pdfPlugin, ref('comment:1', 'data:text/html,<script>top.location="https://evil.test"</script>'))).toBeUndefined();
    expect(pdfEmbedUrl(pdfPlugin, ref('comment:1', ' DATA:application/pdf;base64,AAAA'))).toBeUndefined();
    expect(pdfEmbedUrl(proxyOff, ref('comment:1', 'data:text/html,hi'))).toBeUndefined();
  });

  it('needs the plugin', () => {
    expect(pdfEmbedUrl(undefined, ref('https://example.com/paper.pdf'))).toBeUndefined();
  });
});
