/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MarkdownModule } from 'ngx-markdown';

import { MdComponent } from './md.component';

describe('MdComponent', () => {
  let component: MdComponent;
  let fixture: ComponentFixture<MdComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownModule.forRoot()],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MdComponent);
    component = fixture.componentInstance;
    component.mermaid = false;
    component.clipboard = false;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should switch between BBCode and Markdown without changing the text', async () => {
    component.text = '[b]BBCode[/b] **Markdown**';
    component.plugins = ['plugin/bb'];
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.bbcode strong')?.textContent).toBe('BBCode');
    expect(fixture.nativeElement.textContent).toContain('**Markdown**');

    const ready = firstValueFrom(component.postProcessMarkdown);
    component.plugins = [];
    fixture.detectChanges();
    await ready;
    expect(fixture.nativeElement.querySelector('.bbcode')).toBeNull();
    expect(fixture.nativeElement.querySelector('.md strong')?.textContent).toBe('Markdown');
    expect(fixture.nativeElement.textContent).toContain('[b]BBCode[/b]');
  });

  it('should refresh BBCode previews and emit post-processing events', async () => {
    const postProcess = vi.fn();
    component.postProcessMarkdown.subscribe(postProcess);
    component.plugins = ['plugin/bb'];
    component.text = '[b]first[/b]';
    fixture.detectChanges();
    await fixture.whenStable();
    component.text = '[i]second[/i]';
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.bbcode em')?.textContent).toBe('second');
    expect(postProcess).toHaveBeenCalledTimes(2);
  });

  it('should never trust raw HTML or dangerous BBCode URLs', async () => {
    component.plugins = ['plugin/bb'];
    component.disableSanitizer = true;
    component.text = '<img src=x onerror=alert(1)>[url=javascript:alert(1)]link[/url]';
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img, a')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('should render KaTeX when the LaTeX plugin is enabled', async () => {
    const ready = firstValueFrom(component.postProcessMarkdown);
    component.plugins = ['plugin/latex'];
    component.text = '$x^2$';
    fixture.detectChanges();
    await ready;

    expect(fixture.nativeElement.querySelector('.katex')).toBeTruthy();
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
