/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { createEmbed, EMBED_NESTING } from '../../util/embed';
import { ViewerComponent } from './viewer.component';

describe('ViewerComponent', () => {
  let component: ViewerComponent;
  let fixture: ComponentFixture<ViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        forwardRef(() => ViewerComponent),
        MarkdownModule.forRoot(),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('scopes nesting to each embedded viewer and its descendants', () => {
    const vc = fixture.debugElement.injector.get(ViewContainerRef);
    const ref = { url: 'wiki:Nesting', origin: '' };
    const first = createEmbed(vc, ref);
    const nested = createEmbed(first.injector.get(ViewContainerRef), ref);
    const sibling = createEmbed(vc, ref);

    expect(component.embedNesting).toBe(0);
    expect(vc.injector.get(EMBED_NESTING)).toBe(0);
    expect(first.instance.embedNesting).toBe(1);
    expect(nested.instance.embedNesting).toBe(2);
    expect(sibling.instance.embedNesting).toBe(1);
  });
});
