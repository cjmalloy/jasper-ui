/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { marked } from 'marked';

import { AdminService } from './admin.service';
import { ConfigService } from './config.service';
import { EmbedService } from './embed.service';

@Component({ template: '' })
class HostComponent {
  vc = inject(ViewContainerRef);
}

describe('EmbedService', () => {
  let service: EmbedService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(EmbedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('hashTag tokenizer', () => {
    function findHashTagToken(markdown: string): any {
      let found: any;
      marked.walkTokens(marked.lexer(markdown), t => {
        if (t.type === 'hashTag') found = t;
      });
      return found;
    }

    it('should link plain hashtag to /tag/notes', () => {
      const token = findHashTagToken('#notes');
      expect(token).toBeTruthy();
      expect(token.href).toBe('/tag/notes');
      expect(token.text).toBe('#notes');
    });

    it('should include query params in href for #notes?filter=...', () => {
      const token = findHashTagToken('#notes?filter=query/+user/chris');
      expect(token).toBeTruthy();
      expect(token.href).toBe('/tag/notes?filter=query/+user/chris');
      expect(token.text).toBe('#notes');
    });

    it('should include multiple query params', () => {
      const token = findHashTagToken('#notes?filter=query/+user/chris&sort=created');
      expect(token).toBeTruthy();
      expect(token.href).toBe('/tag/notes?filter=query/+user/chris&sort=created');
      expect(token.text).toBe('#notes');
    });

    it('should consume query params as part of the raw token', () => {
      const token = findHashTagToken('#notes?filter=query/+user/chris');
      expect(token.raw).toBe('#notes?filter=query/+user/chris');
    });
  });

  describe('render images', () => {
    function render(markdown: string) {
      vi.spyOn(TestBed.inject(ConfigService), 'base', 'get').mockReturnValue('http://localhost/');
      const fixture = TestBed.createComponent(HostComponent);
      const el = fixture.nativeElement as HTMLElement;
      service.render(el, markdown, { vc: fixture.componentInstance.vc, origin: '', mermaid: false, clipboard: false });
      fixture.detectChanges();
      return el;
    }

    it('falls back to a link when the image mod is not installed', () => {
      vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockReturnValue(undefined);
      const el = render('<p><img src="https://example.com/a.png" alt="An image"></p>');
      expect(el.querySelector('img')).toBeNull();
      expect(el.querySelector('app-viewer')).toBeNull();
      const link = el.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('https://example.com/a.png');
      expect(link.textContent).toContain('An image');
    });

    it('embeds an image viewer when the image mod is installed', () => {
      vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation((tag: string) => tag === 'plugin/image' ? { tag } as any : undefined);
      const el = render('<p><img src="https://example.com/a.png" alt="An image"></p>');
      expect(el.querySelector('app-viewer')).not.toBeNull();
    });
  });

  describe('renderDocument', () => {
    beforeEach(() => {
      vi.spyOn(TestBed.inject(ConfigService), 'base', 'get').mockReturnValue('http://localhost/');
    });

    it('replaces media with inert placeholders', () => {
      const doc = service.renderDocument([
        '![x](https://example.com/a.png)',
        '<img srcset="https://example.com/s.png 1x, https://example.com/l,big.png 2x">',
        '<picture style="width: 10px"><source srcset="https://example.com/p.png"><img alt="pic"></picture>',
        '<audio><source src="https://example.com/a.mp3"></audio>',
        '<video><source src="https://example.com/v.mp4"></video>',
      ].join('\n\n'));
      expect(doc.querySelectorAll('img, picture, source, audio, video, iframe').length).toBe(0);
      const embeds = Array.from(doc.querySelectorAll<HTMLElement>('.md-embed')).map(e => [e.dataset.plugin, e.dataset.url]);
      expect(doc.querySelector('.inline-embed')!.textContent).toBe('https://example.com/a.png');
      expect(embeds).toEqual([
        ['plugin/image', 'https://example.com/l,big.png'],
        ['plugin/image', 'https://example.com/p.png'],
        ['plugin/audio', 'https://example.com/a.mp3'],
        ['plugin/video', 'https://example.com/v.mp4'],
      ]);
      expect(doc.querySelector<HTMLElement>('[data-url="https://example.com/p.png"]')!.dataset.alt).toBe('pic');
      expect(doc.querySelector<HTMLElement>('[data-url="https://example.com/p.png"]')!.dataset.width).toBe('10px');
    });

    it('converts iframes into placeholders when the sanitizer is disabled', () => {
      const doc = service.renderDocument('<iframe src="https://example.com/embed"></iframe>', '', false, true);
      expect(doc.querySelector('iframe')).toBeNull();
      expect(doc.querySelector<HTMLElement>('.md-embed')!.dataset.plugin).toBe('plugin/embed');
    });

    it('strips scripts and event handlers', () => {
      const doc = service.renderDocument('<p onclick="alert(1)">hi</p><script>alert(1)</script>');
      expect(doc.querySelector('script')).toBeNull();
      expect(doc.querySelector('[onclick]')).toBeNull();
      expect(doc.body.textContent).toContain('hi');
    });

    it('renders wiki links, hashtags and user tags', () => {
      const html = service.renderDocument('[[double bracket]] #science +user/alice').body.innerHTML;
      expect(html).toContain('class="wiki ref"');
      expect(html).toContain('<a class="tag" href="/tag/science" title="#science">#science</a>');
      expect(html).toContain('<a class="user tag" href="/tag/+user/alice" title="User +user/alice">+user/alice</a>');
    });

    it('appends the origin to user tags without an origin', () => {
      const doc = service.renderDocument('+user/alice', '@other');
      expect(doc.querySelector('.user.tag')!.getAttribute('href')).toBe('/tag/+user/alice@other');
    });

    it('preserves the source map', () => {
      const doc = service.renderDocument('# Title\n\nParagraph');
      expect(doc.querySelector('h1')!.getAttribute('aria-posinset')).toBe('0');
      expect(doc.querySelector('p')!.getAttribute('aria-posinset')).toBe('9');
    });
  });
});
