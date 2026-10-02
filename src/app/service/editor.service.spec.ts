/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Europa from 'europa';

import { EditorService } from './editor.service';

describe('EditorService', () => {
  let service: EditorService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(EditorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('HTML to Markdown', () => {
    let europa: Europa;

    beforeEach(() => {
      europa = new Europa({ inline: true });
    });

    it('should convert multiline pre/code blocks to fenced text', () => {
      const html = `<pre><code>static float clamp(float value)
{
    if (value &lt; 1e-4f &amp;&amp; value &gt; 0)
    {
        return value * 2;
    }

    return 0;
}
</code></pre>`;

      expect(europa.convert(html)).toBe(`\`\`\`
static float clamp(float value)
{
    if (value < 1e-4f && value > 0)
    {
        return value * 2;
    }

    return 0;
}
\`\`\``);
    });

    it.each([
      ['<pre>  first\n\n\tsecond  \n</pre>', '```\n  first\n\n\tsecond  \n```'],
      ['<pre><code class="language-c"><span>int</span> *p = &amp;value;</code></pre>', '```\nint *p = &value;\n```'],
      ['<pre><code>&lt;div&gt;&amp;lt;&#60;/div&#62;</code></pre>', '```\n<div>&lt;</div>\n```'],
      ['<pre><code>first</code></pre><pre><code>second</code></pre>', '```\nfirst\n```\n\n```\nsecond\n```'],
      ['<p>Before <code>value</code></p><pre><code>  value</code></pre><p>After</p>', 'Before `value`\n\n```\n  value\n```\n\nAfter'],
      ['<blockquote><pre><code>first\n  second</code></pre></blockquote>', '> ```\n> first\n>   second\n> ```\n> \n>'],
      ['<pre><code></code></pre>', '```\n```'],
      ['<pre><code>```\n````\n</code></pre>', '`````\n```\n````\n`````'],
    ])('should preserve code content and Markdown structure for %s', (html, markdown) => {
      expect(europa.convert(html)).toBe(markdown);
    });
  });
});
