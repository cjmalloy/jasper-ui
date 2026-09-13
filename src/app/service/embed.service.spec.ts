/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, Type, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { marked } from 'marked';
import { MarkdownModule } from 'ngx-markdown';
import { of, Subject } from 'rxjs';
import { MockInstance } from 'vitest';

import { CommentComponent } from '../component/comment/comment.component';
import { EmbedPlaceholderComponent } from '../component/embed-placeholder/embed-placeholder.component';
import { LensComponent } from '../component/lens/lens.component';
import { NavComponent } from '../component/nav/nav.component';
import { RefComponent } from '../component/ref/ref.component';
import { ViewerComponent } from '../component/viewer/viewer.component';
import { Ref } from '../model/ref';
import { EMBED_NESTING, createEmbed, createLens, createRef } from '../util/embed';
import { AdminService } from './admin.service';
import { RefService } from './api/ref.service';
import { ConfigService } from './config.service';
import { EditorService } from './editor.service';
import { EmbedService } from './embed.service';

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

  describe('embed nesting', () => {
    const url = '/ref/wiki:Recursive';
    const ref: Ref = { url: 'wiki:Recursive', origin: '', comment: `![](${url})` };
    let getCurrent: MockInstance<RefService['getCurrent']>;

    beforeEach(() => {
      getCurrent = vi.spyOn(TestBed.inject(RefService), 'getCurrent').mockReturnValue(of(ref));
      vi.spyOn(TestBed.inject(EditorService), 'getUrlType')
        .mockImplementation(url => url.startsWith('/tag/') ? 'tag' : 'ref');
      vi.spyOn(TestBed.inject(EditorService), 'getRefUrl').mockImplementation(url => url);
      vi.spyOn(TestBed.inject(AdminService), 'getEmbeds').mockReturnValue([]);
    });

    function container(injector = TestBed.inject(Injector), html = `<div class="loading inline-embed">${url}</div>`) {
      const el = document.createElement('div');
      el.innerHTML = html;
      el.querySelectorAll<HTMLElement>('.inline-ref, .inline-embed').forEach(t => t.innerText = t.textContent || '');
      const createComponent = vi.fn((component: Type<unknown>, options?: { injector: Injector }) => ({
        injector: options?.injector || injector,
        location: { nativeElement: document.createElement('div') },
        instance: { init: vi.fn(), create: undefined as ((vc: ViewContainerRef) => void) | undefined },
      }));
      const vc = { element: { nativeElement: el }, injector, createComponent } as unknown as ViewContainerRef;
      const event = vi.fn();
      return { el, vc, event, createComponent };
    }

    it.each([1, 3, 5])('stops asynchronous recursive embeds at depth %i', async max => {
      TestBed.inject(ConfigService).maxEmbedNesting = max;
      let injector = TestBed.inject(Injector);
      for (let depth = 0; depth <= max; depth++) {
        const current = container(injector);
        const cleanup = service.postProcess(current.vc, current.event);
        expect(getCurrent).toHaveBeenCalledTimes(depth + 1);
        expect(current.el.querySelector('.loading')).toBeNull();
        const created = current.createComponent.mock.results[0].value;
        injector = created.injector;
        expect(injector.get(EMBED_NESTING)).toBe(Math.min(depth + 1, max));
        if (depth === max) {
          expect(current.createComponent).toHaveBeenCalledWith(EmbedPlaceholderComponent);
          expect(created.instance.init).not.toHaveBeenCalled();
          expect(created.instance.create).toBeTypeOf('function');
        } else {
          expect(created.instance.init).toHaveBeenCalledOnce();
        }
        await Promise.resolve();
        cleanup();
      }
    });

    it('does not share nesting limits between sibling embeds', () => {
      TestBed.inject(ConfigService).maxEmbedNesting = 1;
      const siblings = [container(), container()];
      siblings.forEach(sibling => service.postProcess(sibling.vc, sibling.event));
      expect(getCurrent).toHaveBeenCalledTimes(2);
      siblings.forEach(sibling => {
        expect(sibling.createComponent.mock.results[0].value.injector.get(EMBED_NESTING)).toBe(1);
      });
    });

    it('does not increase depth when a markdown host is reprocessed', () => {
      TestBed.inject(ConfigService).maxEmbedNesting = 1;
      const root = container(undefined, '');
      service.postProcess(root.vc, root.event);
      service.postProcess(root.vc, root.event);
      root.el.innerHTML = `<div class="inline-embed">${url}</div>`;
      (root.el.firstElementChild as HTMLElement).innerText = url;
      service.postProcess(root.vc, root.event);
      expect(getCurrent).toHaveBeenCalledTimes(1);
    });

    it('keeps pending requests cancellable', () => {
      const response = new Subject<Ref>();
      getCurrent.mockReturnValue(response);
      const root = container();
      const cleanup = service.postProcess(root.vc, root.event);
      cleanup();
      response.next(ref);
      expect(root.createComponent).not.toHaveBeenCalled();
    });

    it('propagates nesting through inline refs and query lenses', () => {
      const root = container();
      const inlineRef = createRef(root.vc, ref);
      const child = container(inlineRef.injector);
      const lens = createLens(child.vc, {}, {
        content: [],
        page: { number: 0, size: 0, totalPages: 0, totalElements: 0 },
      }, 'recursive');
      expect(inlineRef.injector.get(EMBED_NESTING)).toBe(1);
      expect(lens.injector.get(EMBED_NESTING)).toBe(2);
      const nested = container(lens.injector);
      service.postProcess(nested.vc, nested.event);
      expect(nested.createComponent.mock.results[0].value.injector.get(EMBED_NESTING)).toBe(3);
    });

    it.each([
      ['viewer', (vc: ViewContainerRef) => createEmbed(vc, ref, true), ViewerComponent],
      ['ref', (vc: ViewContainerRef) => createRef(vc, ref, true), RefComponent],
      ['comment', (vc: ViewContainerRef) => createRef(vc, { ...ref, tags: ['plugin/comment'] }), CommentComponent],
      ['lens', (vc: ViewContainerRef) => createLens(vc, { sort: 'created' }, {
        content: [ref],
        page: { number: 0, size: 1, totalPages: 1, totalElements: 1 },
      }, 'recursive'), LensComponent],
    ] as const)('defers %s initialization and expands only one level', (_name, create, component) => {
      TestBed.inject(ConfigService).maxEmbedNesting = 1;
      const injector = Injector.create({
        parent: TestBed.inject(Injector),
        providers: [{ provide: EMBED_NESTING, useValue: 1 }],
      });
      const root = container(injector);
      create(root.vc);
      expect(root.createComponent).toHaveBeenCalledWith(EmbedPlaceholderComponent);
      const placeholder = root.createComponent.mock.results[0].value;
      expect(placeholder.instance.init).not.toHaveBeenCalled();

      const content = container(injector);
      placeholder.instance.create!(content.vc);
      expect(content.createComponent).toHaveBeenCalledWith(component, expect.anything());
      const expanded = content.createComponent.mock.results[0].value;
      expect(expanded.instance.init).toHaveBeenCalledOnce();
      expect(expanded.injector.get(EMBED_NESTING)).toBe(2);

      const nested = container(expanded.injector);
      create(nested.vc);
      expect(nested.createComponent).toHaveBeenCalledWith(EmbedPlaceholderComponent);
      expect(nested.createComponent.mock.results[0].value.instance.init).not.toHaveBeenCalled();
      const sibling = container(injector);
      create(sibling.vc);
      expect(sibling.createComponent).toHaveBeenCalledWith(EmbedPlaceholderComponent);
    });

    it('preserves links and toggles and uses placeholders for refs, queries, and media at the limit', () => {
      TestBed.inject(ConfigService).maxEmbedNesting = 1;
      const root = container();
      service.postProcess(root.vc, root.event);
      getCurrent.mockClear();
      const child = container(root.createComponent.mock.results[0].value.injector, `
        <div class="loading inline-ref">${url}</div>
        <div class="loading inline-embed">/tag/recursive</div>
        <picture><source src="unsafe:https://example.com/image"><img></picture>
        <img src="unsafe:https://example.com/image">
        <audio><source src="https://example.com/audio"></audio>
        <video><source src="https://example.com/video"></video>
        <span class="toggle inline" title="${url}"></span>
        <span class="toggle embed" title="${url}"></span>
        <a href="/tag/notes">Notes</a>
      `);
      const loadQuery = vi.spyOn(service, 'loadQuery$').mockReturnValue(of({
        params: {},
        page: { content: [], page: { number: 0, size: 0, totalPages: 0, totalElements: 0 } },
        ext: undefined,
      }));
      service.postProcess(child.vc, child.event);
      expect(getCurrent).toHaveBeenCalledOnce();
      expect(loadQuery).toHaveBeenCalledWith('/tag/recursive');
      expect(child.event).toHaveBeenCalledTimes(2);
      expect(child.el.querySelectorAll('.toggle')).toHaveLength(2);
      expect(child.el.querySelector('.loading, img, picture, audio, video')).toBeNull();
      expect(child.createComponent.mock.calls.map(([component]) => component))
        .toEqual([...Array(6).fill(EmbedPlaceholderComponent), NavComponent]);
    });
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
});
