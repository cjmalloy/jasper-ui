/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
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
        provideHttpClient(withInterceptorsFromDi()),
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
});
