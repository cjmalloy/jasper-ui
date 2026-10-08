/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { marked } from 'marked';
import { MarkdownModule } from 'ngx-markdown';

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
      imports: [MarkdownModule.forRoot()],
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

  describe('postProcess images', () => {
    function render(html: string) {
      vi.spyOn(TestBed.inject(ConfigService), 'base', 'get').mockReturnValue('http://localhost/');
      const fixture = TestBed.createComponent(HostComponent);
      const el = fixture.nativeElement as HTMLElement;
      el.innerHTML = html;
      service.postProcess(fixture.componentInstance.vc, () => {});
      fixture.detectChanges();
      return el;
    }

    it('falls back to a link when the image mod is not installed', () => {
      vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockReturnValue(undefined);
      const el = render('<p><img src="unsafe:https://example.com/a.png" alt="An image"></p>');
      expect(el.querySelector('img')).toBeNull();
      expect(el.querySelector('app-viewer')).toBeNull();
      const link = el.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('https://example.com/a.png');
      expect(link.textContent).toContain('An image');
    });

    it('embeds an image viewer when the image mod is installed', () => {
      vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation((tag: string) => tag === 'plugin/image' ? { tag } as any : undefined);
      const el = render('<p><img src="unsafe:https://example.com/a.png" alt="An image"></p>');
      expect(el.querySelector('app-viewer')).not.toBeNull();
    });
  });
});
