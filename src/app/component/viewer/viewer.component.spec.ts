/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import * as Handlebars from 'handlebars/dist/cjs/handlebars';

import { AdminService } from '../../service/admin.service';
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

  it('clears the container width when the layout changes', () => {
    const container = document.createElement('div');
    container.style.width = '80%';
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    container.appendChild(iframe);
    (component as any).iframe = () => ({ nativeElement: iframe });
    (component as any).embedSize.set({ width: 1, height: 1 });
    (component as any).resizeEmbed();
    expect(iframe.style.width).toBe('');
    expect(container.style.width).toBe('');
  });

  it('follows the zoomed oEmbed height again after entering fullscreen', () => {
    const container = document.createElement('div');
    container.classList.add('zoom');
    const iframe = document.createElement('iframe');
    container.appendChild(iframe);
    document.body.appendChild(container);
    (component as any).iframe = () => ({ nativeElement: iframe });
    (component as any).zoom = () => true;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => component.el.nativeElement });
    document.dispatchEvent(new Event('fullscreenchange'));
    window.dispatchEvent(new MessageEvent('message', { data: { jasperIframeHeight: 900 }, source: iframe.contentWindow }));
    delete (document as any).fullscreenElement;
    container.remove();
    expect(iframe.style.height).toBe('900px');
  });

  it('clears derived lens state when a viewer is reused for an ordinary ref', () => {
    fixture.componentRef.setInput('ref', { url: 'tag:/science', tags: ['plugin/lens'] });
    expect(component.lens()).toBe(true);
    fixture.componentRef.setInput('ref', { url: 'https://example.com', tags: [] });
    expect(component.lens()).toBe(false);
    expect(component.lensPage()).toBeUndefined();
    expect(component.lensQuery()).toBe('');
  });

  it('does not show an image when the image mod is not installed', () => {
    vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockReturnValue(undefined);
    fixture.componentRef.setInput('ref', { url: 'https://example.com/a.png', origin: '', tags: ['plugin/image'] });
    expect(component.imageUrl()).toBe('');
  });

  it('shows an image when the image mod is installed', () => {
    vi.spyOn(TestBed.inject(AdminService), 'getPlugin').mockImplementation((tag: string) => tag === 'plugin/image' ? { tag } as any : undefined);
    fixture.componentRef.setInput('ref', { url: 'https://example.com/a.png', origin: '', tags: ['plugin/image'] });
    expect(component.imageUrl()).toBe('https://example.com/a.png');
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
    const button = placeholder.location.nativeElement.querySelector('.load-more') as HTMLLinkElement;
    button.click();
    button.click();
    placeholder.changeDetectorRef.detectChanges();
    expect(init).toHaveBeenCalledOnce();
    expect(placeholder.location.nativeElement.querySelector('.load-more')).toBeNull();

    const viewer = init.mock.instances[0] as ViewerComponent;
    expect(viewer.ref()).toBe(ref);
    expect(viewer.fullscreen()).toBe(true);
    const view = (placeholder.instance as EmbedPlaceholderComponent).content().get(0)!;
    const destroy = vi.fn();
    view.onDestroy(destroy);
    placeholder.destroy();
    expect(view.destroyed).toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('hydrates plugin UIs once until the Ref changes', () => {
    const hydrated = vi.fn(() => '');
    Handlebars.registerHelper('viewerSpecHydrated', hydrated);
    const admin = TestBed.inject(AdminService);
    const plugin = { tag: 'plugin/test', config: { ui: '{{viewerSpecHydrated}}' } };
    vi.spyOn(admin, 'getPluginUi').mockReturnValue([plugin]);
    vi.spyOn(admin, 'getPlugin').mockReturnValue(plugin);
    fixture.componentRef.setInput('ref', { url: 'https://example.com', tags: ['plugin/test'] });
    expect(component.uiMarkdowns().map(ui => ui.tag)).toEqual(['plugin/test']);
    component.uiMarkdowns();
    expect(hydrated).toHaveBeenCalledOnce();
  });
});
