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

    it.each([
      ['<p>This is <em>italic</em> text</p>', 'This is _italic_ text'],
      ['<p>This is <em> italic </em> text</p>', 'This is _italic_ text'],
      ['<p>This is<em> italic</em> text</p>', 'This is _italic_ text'],
      ['<p>This is <em>italic </em>text</p>', 'This is _italic_ text'],
      ['<p>This is <i>italic</i>, ok</p>', 'This is _italic_, ok'],
      ['<p>This is <strong>bold </strong>text</p>', 'This is **bold** text'],
      ['<p>This is<b> bold</b> text</p>', 'This is **bold** text'],
      ['<p>foo<em>bar</em>baz</p>', 'foo*bar*baz'],
      ['<p>foo<strong>bar</strong>baz</p>', 'foo**bar**baz'],
      ['<p>a<em> </em>b</p>', 'a b'],
      ['<p>a<em></em>b</p>', 'ab'],
      ['<p>x <em><strong>bi</strong></em> y</p>', 'x _**bi**_ y'],
      ['<p>x <em> <strong> bi </strong> </em> y</p>', 'x _**bi**_ y'],
      ['<p>x <em>a <a href="http://x">l</a> b</em> y</p>', 'x _a [l](http://x) b_ y'],
      ['<p><em>\n  multi\n  line\n</em></p>', '_multi\nline_'],
      ['<blockquote><p>a <em>b\n</em>c</p></blockquote>', '> a _b_\n> c\n> \n>'],
      ['<p><em>hello!</em><strong>world</strong></p>', '_hello!_**world**'],
      ['<p><em>foo</em><code>x</code></p>', '_foo_`x`'],
      ['<p><span><em>foo</em></span>bar</p>', '*foo*bar'],
      ['<p><em>foo</em><span></span>bar</p>', '*foo*bar'],
      ['<p><em>foo</em><span><b></b>bar</span></p>', '*foo*bar'],
      ['<p><em>foo</em></p><p>bar</p>', '_foo_\n\nbar'],
      ['<div><em>foo</em><figure>bar</figure></div>', '*foo*bar'],
      ['<table><tr><td><em>foo</em></td><td>bar</td></tr></table>', '*foo*bar'],
      ['<p><em>foo</em><a href="">bar</a></p>', '*foo*bar'],
      ['<p><em>foo</em><img>bar</p>', '*foo*bar'],
      ['<p><em>foo</em><audio>x</audio>bar</p>', '*foo*bar'],
      ['<p><em>foo</em><video></video>bar</p>', '*foo*bar'],
      ['<p><em>foo</em><img src="i.png">bar</p>', '_foo_![](i.png)bar'],
      ['<a href="http://x"><em>foo</em><div>bar</div></a>', '[*foo*bar](http://x)'],
    ])('should handle whitespace around emphasis for %s', (html, markdown) => {
      expect(europa.convert(html)).toBe(markdown);
    });
  });
});
