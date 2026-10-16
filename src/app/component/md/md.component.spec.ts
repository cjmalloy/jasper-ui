/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
    fixture.componentRef.setInput('mermaid', false);
    fixture.componentRef.setInput('clipboard', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function postProcessReady() {
    return new Promise<void>(resolve => {
      const sub = component.postProcessMarkdown.subscribe(() => {
        sub.unsubscribe();
        resolve();
      });
    });
  }

  it('should render KaTeX when the LaTeX plugin is enabled', async () => {
    const ready = postProcessReady();
    fixture.componentRef.setInput('plugins', ['plugin/latex']);
    fixture.componentRef.setInput('text', '$x^2$');
    fixture.detectChanges();
    await ready;

    expect(fixture.nativeElement.querySelector('.katex')).toBeTruthy();
  });

  it('should block object tags in markdown content', async () => {
    // Set markdown content with an object tag
    fixture.componentRef.setInput('text', '<object data="test.pdf" type="application/pdf"></object>');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement;
    const objectTags = element.querySelectorAll('object');
    
    // Verify that object tags are sanitized/removed by default
    expect(objectTags.length).toBe(0);
  });

  it('should block embed tags in markdown content', async () => {
    // Set markdown content with an embed tag
    fixture.componentRef.setInput('text', '<embed src="test.pdf" type="application/pdf">');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement;
    const embedTags = element.querySelectorAll('embed');
    
    // Verify that embed tags are sanitized/removed by default
    expect(embedTags.length).toBe(0);
  });

  it('should block object tags in mixed markdown content', async () => {
    // Set markdown content with text and an object tag
    const ready = postProcessReady();
    fixture.componentRef.setInput('text', 'This is some text\n\n<object data="malicious.swf" type="application/x-shockwave-flash"></object>\n\nMore text');
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
    const ready = postProcessReady();
    fixture.componentRef.setInput('text', '# Heading\n\n<embed src="dangerous.swf" type="application/x-shockwave-flash">\n\nSafe paragraph');
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
