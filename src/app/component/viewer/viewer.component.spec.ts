/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { ConfigService } from '../../service/config.service';
import { createEmbed, EMBED_NESTING } from '../../util/embed';
import { EmbedPlaceholderComponent } from '../embed-placeholder/embed-placeholder.component';
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

    expect(fixture.debugElement.injector.get(EMBED_NESTING)).toBe(0);
    expect(vc.injector.get(EMBED_NESTING)).toBe(0);
    expect(first.injector.get(EMBED_NESTING)).toBe(1);
    expect(nested.injector.get(EMBED_NESTING)).toBe(2);
    expect(sibling.injector.get(EMBED_NESTING)).toBe(1);
  });

  it('creates a deferred viewer once and destroys it with its placeholder', () => {
    TestBed.inject(ConfigService).maxEmbedNesting = 1;
    const vc = fixture.debugElement.injector.get(ViewContainerRef);
    const ref = { url: 'wiki:Nesting', origin: '' };
    const first = createEmbed(vc, ref);
    const init = vi.spyOn(ViewerComponent.prototype, 'init');
    const placeholder = createEmbed(first.injector.get(ViewContainerRef), ref, true);
    expect(placeholder.instance).toBeInstanceOf(EmbedPlaceholderComponent);
    expect(init).not.toHaveBeenCalled();
    placeholder.changeDetectorRef.detectChanges();
    const button = placeholder.location.nativeElement.querySelector('.embed-expand') as HTMLButtonElement;
    expect(button.type).toBe('button');
    button.click();
    button.click();
    placeholder.changeDetectorRef.detectChanges();
    expect(init).toHaveBeenCalledOnce();
    expect(placeholder.location.nativeElement.querySelector('.embed-expand')).toBeNull();

    const viewer = init.mock.instances[0] as ViewerComponent;
    expect(viewer.ref).toBe(ref);
    expect(viewer.fullscreen).toBe(true);
    const view = (placeholder.instance as EmbedPlaceholderComponent).content.get(0)!;
    const destroy = vi.fn();
    view.onDestroy(destroy);
    placeholder.destroy();
    expect(view.destroyed).toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
  });
});
