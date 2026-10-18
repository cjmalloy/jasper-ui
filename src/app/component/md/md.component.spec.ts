/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../service/config.service';
import { EmbedService } from '../../service/embed.service';
import { pele } from '../../util/mermaid';

import { MdComponent } from './md.component';

describe('MdComponent', () => {
  let component: MdComponent;
  let fixture: ComponentFixture<MdComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    vi.spyOn(TestBed.inject(ConfigService), 'base', 'get').mockReturnValue('http://localhost/');
    fixture = TestBed.createComponent(MdComponent);
    component = fixture.componentInstance;
    component.mermaid = false;
    component.clipboard = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render KaTeX when the LaTeX plugin is enabled', async () => {
    const ready = firstValueFrom(component.postProcessMarkdown);
    component.plugins = ['plugin/latex'];
    component.text = '$x^2$';
    fixture.detectChanges();
    await ready;

    expect(fixture.nativeElement.querySelector('.katex')).toBeTruthy();
  });

  it('should not render KaTeX without the LaTeX plugin', () => {
    component.text = '$x^2$';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.katex')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('$x^2$');
  });

  it('should emit postProcessMarkdown after rendering', async () => {
    const ready = firstValueFrom(component.postProcessMarkdown);
    component.text = 'Hello';
    fixture.detectChanges();
    await ready;

    expect(fixture.nativeElement.textContent).toContain('Hello');
  });

  it('should only re-render when text, plugins or origin change', () => {
    const embeds = TestBed.inject(EmbedService);
    const render = vi.spyOn(embeds, 'render');
    component.text = 'Hello';
    component.plugins = ['plugin/latex'];
    fixture.detectChanges();
    fixture.detectChanges();
    component.plugins = ['plugin/latex'];
    fixture.detectChanges();
    expect(render).toHaveBeenCalledTimes(1);

    component.origin = '@other';
    fixture.detectChanges();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('should never attach images to the live DOM before hydration', () => {
    const embeds = TestBed.inject(EmbedService);
    const imageSpy = vi.spyOn(window, 'Image');
    const srcSpy = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
    let imagesAtAttach = -1;
    let placeholdersAtAttach = -1;
    vi.spyOn(embeds, 'hydrate').mockImplementation(host => {
      imagesAtAttach = host.querySelectorAll('img, picture, source').length;
      placeholdersAtAttach = host.querySelectorAll('.md-embed').length;
      return () => {};
    });
    component.disableSanitizer = true;
    component.text = '![a](https://example.com/a.png)\n\n<img src="https://example.com/b.png" onerror="alert(1)">\n\n<picture><source srcset="https://example.com/c.png"><img></picture>';
    fixture.detectChanges();

    expect(imagesAtAttach).toBe(0);
    expect(placeholdersAtAttach).toBe(2);
    expect(imageSpy).not.toHaveBeenCalled();
    expect(srcSpy).not.toHaveBeenCalled();
  });

  it('should preserve the source map', () => {
    component.text = '# Title\n\nParagraph';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').getAttribute('aria-posinset')).toBe('0');
    expect(fixture.nativeElement.querySelector('p').getAttribute('aria-posinset')).toBe('9');
  });

  it('should render mermaid diagrams', () => {
    const mount = vi.spyOn(pele, 'mountAsync').mockReturnValue(new Promise(() => {}));
    component.mermaid = true;
    component.text = '```mermaid\ngraph TB\n  A --> B\n```';
    fixture.detectChanges();

    const diagram = fixture.nativeElement.querySelector('.mermaid');
    expect(diagram).toBeTruthy();
    expect(fixture.nativeElement.querySelector('pre')).toBeNull();
    expect(mount).toHaveBeenCalledWith(diagram, 'graph TB\n  A --> B\n');
  });

  it('should show a render button for mermaid when disabled', () => {
    const mount = vi.spyOn(pele, 'mountAsync').mockReturnValue(new Promise(() => {}));
    component.text = '```mermaid\ngraph TB\n  A --> B\n```';
    fixture.detectChanges();

    expect(mount).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.mermaid')).toBeNull();
    const button = fixture.nativeElement.querySelector('.mermaid-render') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();

    const diagram = fixture.nativeElement.querySelector('.mermaid');
    expect(diagram).toBeTruthy();
    expect(fixture.nativeElement.querySelector('pre')).toBeNull();
    expect(mount).toHaveBeenCalledWith(diagram, 'graph TB\n  A --> B\n');
  });

  it('should add clipboard buttons to code blocks', () => {
    component.clipboard = true;
    component.text = '```\ncode\n```';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.md-pre > pre')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.markdown-clipboard-button')).toBeTruthy();
  });

  it('should re-render when mermaid, clipboard or sanitizer inputs change', () => {
    component.text = '```\ncode\n```';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.markdown-clipboard-button')).toBeNull();

    component.clipboard = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.markdown-clipboard-button')).toBeTruthy();

    component.text = '<span onclick="x">a</span>';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').hasAttribute('onclick')).toBe(false);
    component.disableSanitizer = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span').hasAttribute('onclick')).toBe(true);
  });

  it('should keep a stable source mapped container for mermaid diagrams', () => {
    const mount = vi.spyOn(pele, 'mountAsync').mockReturnValue(new Promise(() => {}));
    component.text = '# Title\n\n```mermaid\ngraph TB\n  A --> B\n```';
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.md-mermaid') as HTMLElement;
    expect(container.getAttribute('aria-posinset')).toBe('9');
    (fixture.nativeElement.querySelector('.mermaid-render') as HTMLButtonElement).click();
    expect(container.isConnected).toBe(true);
    expect(container.querySelector('.mermaid')).toBeTruthy();
    expect(mount).toHaveBeenCalled();

    component.mermaid = true;
    fixture.detectChanges();
    const rendered = fixture.nativeElement.querySelector('.md-mermaid') as HTMLElement;
    expect(rendered.getAttribute('aria-posinset')).toBe('9');
    expect(rendered.querySelector('.mermaid')).toBeTruthy();
  });

  it('should ignore forged embed placeholders', () => {
    component.text = '<span class="md-embed" data-url="javascript:alert(1)" data-plugin="plugin/embed">x</span>';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.md-embed')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-url]')).toBeNull();
  });

  it('should render wiki links, hashtags and user tags as links', () => {
    component.text = '[[double bracket]] #science +user/alice';
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map(a => a.textContent?.trim())).toEqual(['double bracket', '#science', '+user/alice']);
    expect(links[0].classList).toContain('wiki');
    expect(links[1].classList).toContain('tag');
    expect(links[2].classList).toContain('user');
  });

  it('should block object tags in markdown content', async () => {
    // Set markdown content with an object tag
    component.text = '<object data="test.pdf" type="application/pdf"></object>';
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement;
    const objectTags = element.querySelectorAll('object');
    
    // Verify that object tags are sanitized/removed by default
    expect(objectTags.length).toBe(0);
  });

  it('should block embed tags in markdown content', async () => {
    // Set markdown content with an embed tag
    component.text = '<embed src="test.pdf" type="application/pdf">';
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement;
    const embedTags = element.querySelectorAll('embed');
    
    // Verify that embed tags are sanitized/removed by default
    expect(embedTags.length).toBe(0);
  });

  it('should block object tags in mixed markdown content', async () => {
    // Set markdown content with text and an object tag
    const ready = firstValueFrom(component.postProcessMarkdown);
    component.text = 'This is some text\n\n<object data="malicious.swf" type="application/x-shockwave-flash"></object>\n\nMore text';
    fixture.detectChanges();
    await ready;

    const element = fixture.nativeElement;
    const objectTags = element.querySelectorAll('object');
    
    // Verify that object tags are sanitized/removed
    expect(objectTags.length).toBe(0);
    
    // Verify that safe text content is still rendered
    expect(element.textContent).toContain('This is some text');
    expect(element.textContent).toContain('More text');
  });

  it('should block embed tags in mixed markdown content', async () => {
    // Set markdown content with text and an embed tag
    const ready = firstValueFrom(component.postProcessMarkdown);
    component.text = '# Heading\n\n<embed src="dangerous.swf" type="application/x-shockwave-flash">\n\nSafe paragraph';
    fixture.detectChanges();
    await ready;

    const element = fixture.nativeElement;
    const embedTags = element.querySelectorAll('embed');
    
    // Verify that embed tags are sanitized/removed
    expect(embedTags.length).toBe(0);
    
    // Verify that safe markdown is still rendered
    expect(element.textContent).toContain('Heading');
    expect(element.textContent).toContain('Safe paragraph');
  });
  describe('progressive', () => {
    const host = () => fixture.nativeElement.querySelector('.md') as HTMLElement;
    const children = () => Array.from(host().children) as HTMLElement[];
    async function type(text: string) {
      const ready = firstValueFrom(component.postProcessMarkdown);
      component.text = text;
      fixture.detectChanges();
      await ready;
    }

    beforeEach(() => {
      component.progressive = true;
    });

    it('should keep unchanged blocks when editing a paragraph', async () => {
      const mount = vi.spyOn(pele, 'mountAsync').mockReturnValue(new Promise(() => {}));
      const create = vi.spyOn(component.vc, 'createComponent');
      component.mermaid = true;
      const rest = '\n\n```mermaid\ngraph TB\n  A --> B\n```\n\n<img src="https://example.com/a.png">';
      await type('Para one' + rest);
      expect(mount).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
      const [para, mermaid, image] = children();
      const diagram = host().querySelector('.mermaid');
      expect(para.textContent).toBe('Para one');
      expect(mermaid.classList).toContain('md-mermaid');

      await type('Para two' + rest);

      expect(mount).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
      const after = children();
      expect(after[0]).not.toBe(para);
      expect(after[0].textContent).toBe('Para two');
      expect(after[1]).toBe(mermaid);
      expect(after[2]).toBe(image);
      expect(host().querySelector('.mermaid')).toBe(diagram);
    });

    it('should coalesce text changes until the next frame', async () => {
      await type('One\n\nTwo');
      const render = vi.spyOn(TestBed.inject(EmbedService), 'renderBlock');
      const ready = firstValueFrom(component.postProcessMarkdown);
      component.text = 'One\n\nTwo!';
      fixture.detectChanges();
      component.text = 'One\n\nTwo!!';
      fixture.detectChanges();
      expect(render).not.toHaveBeenCalled();
      await ready;
      expect(render).toHaveBeenCalledTimes(1);
      expect(host().textContent).toContain('Two!!');
    });

    it('should shift the source map of kept blocks', async () => {
      const rest = 'One\n\n| a |\n|---|\n| b |\n\n```mermaid\ngraph TB\n```';
      await type(rest);
      const table = host().querySelector('table')!;
      const mermaid = host().querySelector('.md-mermaid')!;
      const positions = () => Array.from(host().querySelectorAll('[aria-posinset]'))
        .map(el => el.getAttribute('aria-posinset'));
      const before = positions();
      expect(table.getAttribute('aria-posinset')).toBe('5');
      expect(mermaid.getAttribute('aria-posinset')).toBe('24');

      await type('Zero\n\n' + rest);

      expect(host().querySelector('table')).toBe(table);
      expect(host().querySelector('.md-mermaid')).toBe(mermaid);
      expect(table.getAttribute('aria-posinset')).toBe('11');
      expect(mermaid.getAttribute('aria-posinset')).toBe('30');
      const shifted = before.map(p => isNaN(+p!) ? p : '' + (+p! + 6));
      expect(positions()).toEqual(['0', ...shifted]);
      component.progressive = false;
      fixture.detectChanges();
      expect(positions()).toEqual(['0', ...shifted]);
    });

    it('should only re-render blocks with iframes when reloading iframes', async () => {
      await type('One\n\nTwo\n\nThree');
      const [one, two, three] = children();
      two.appendChild(document.createElement('iframe'));
      const ready = firstValueFrom(component.postProcessMarkdown);

      component.reloadIframes();
      await ready;

      const after = children();
      expect(after[0]).toBe(one);
      expect(after[1]).not.toBe(two);
      expect(after[1].textContent).toBe('Two');
      expect(after[1].querySelector('iframe')).toBeNull();
      expect(after[2]).toBe(three);
    });

    it('should not re-render when reloading without iframes', async () => {
      await type('One\n\nTwo');
      const before = children();
      const render = vi.spyOn(TestBed.inject(EmbedService), 'renderBlock');

      component.reloadIframes();

      expect(render).not.toHaveBeenCalled();
      expect(children()).toEqual(before);
    });

    it('should destroy views and subscriptions of removed blocks', async () => {
      const http = TestBed.inject(HttpTestingController);
      await type('Keep\n\n[link](https://example.com)\n\n![=](https://example.com/ref)');
      expect(component.vc.length).toBe(1);
      const [req] = http.match(r => r.url.endsWith('/ref/page'));
      expect(req.request.params.get('url')).toBe('https://example.com/ref');
      const keep = children()[0];

      await type('Keep');

      expect(children()[0]).toBe(keep);
      expect(children().length).toBe(1);
      expect(component.vc.length).toBe(0);
      expect(req.cancelled).toBe(true);
    });

    it('should fully re-render when reference links change', async () => {
      await type('Keep\n\nMore\n\nAnd more\n\n[a][x]\n\n[x]: https://a.com');
      const keep = children()[0];

      await type('Keep\n\nMore\n\nAnd more\n\n[a][x]\n\n[x]: https://b.com');

      expect(children()[0]).not.toBe(keep);
      expect(children()[0].textContent).toBe('Keep');
    });

    it('should fully re-render when other inputs change', () => {
      component.text = 'Keep\n\n<span onclick="x">a</span>';
      fixture.detectChanges();
      let keep = children()[0];

      component.plugins = ['plugin/latex'];
      fixture.detectChanges();
      expect(children()[0]).not.toBe(keep);
      keep = children()[0];

      component.origin = '@other';
      fixture.detectChanges();
      expect(children()[0]).not.toBe(keep);
      keep = children()[0];

      expect(host().querySelector('span')!.hasAttribute('onclick')).toBe(false);
      component.disableSanitizer = true;
      fixture.detectChanges();
      expect(children()[0]).not.toBe(keep);
      expect(host().querySelector('span')!.hasAttribute('onclick')).toBe(true);
    });

    it('should keep raw HTML blocks together', async () => {
      await type('<details>\n\nhidden\n\n</details>\n\nafter');
      expect(host().querySelector('details p')?.textContent).toBe('hidden');
      expect(children().at(-1)!.textContent).toBe('after');
    });

    it('should never attach images to the live DOM before hydration', () => {
      const embeds = TestBed.inject(EmbedService);
      const imageSpy = vi.spyOn(window, 'Image');
      const srcSpy = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
      let images = 0;
      let placeholders = 0;
      vi.spyOn(embeds, 'hydrate').mockImplementation(root => {
        expect(root.isConnected).toBe(false);
        images += root.querySelectorAll('img, picture, source').length;
        placeholders += root.querySelectorAll('.md-embed').length;
        return () => {};
      });
      component.disableSanitizer = true;
      component.text = '![a](https://example.com/a.png)\n\n<img src="https://example.com/b.png" onerror="alert(1)">\n\n<picture><source srcset="https://example.com/c.png"><img></picture>';
      fixture.detectChanges();

      expect(images).toBe(0);
      expect(placeholders).toBe(2);
      expect(host().querySelectorAll('img, picture, source').length).toBe(0);
      expect(imageSpy).not.toHaveBeenCalled();
      expect(srcSpy).not.toHaveBeenCalled();
    });
  });
});
