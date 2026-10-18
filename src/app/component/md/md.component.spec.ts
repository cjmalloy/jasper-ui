/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
});
