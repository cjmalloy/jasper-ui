/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';
import { ProxyService } from '../../service/api/proxy.service';
import { PluginsFormComponent } from '../plugins/plugins.component';

import { RefFormComponent } from './ref.component';

describe('RefFormComponent', () => {
  let component: RefFormComponent;
  let fixture: ComponentFixture<RefFormComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        RefFormComponent
      ],
      providers: [
        PluginsFormComponent,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    component.group = new UntypedFormGroup({
      url: new UntypedFormControl(),
      published: new UntypedFormControl(),
      title: new UntypedFormControl(),
      comment: new UntypedFormControl(),
      sources: new UntypedFormArray([]),
      alternateUrls: new UntypedFormArray([]),
      tags: new UntypedFormArray([]),
      plugins: new UntypedFormGroup({}),
    });
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock?.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows a thumbnail preview only when creating a Ref with thumbnail data', () => {
    vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag => {
      return tag === 'plugin/thumbnail' ? {} as any : undefined;
    });
    component.tags.push(new UntypedFormControl('plugin/thumbnail'));

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.thumbnail-preview')).toBeNull();

    component.creating = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.thumbnail-preview .thumbnail')).not.toBeNull();
  });

  it('includes the disabled URL in creation thumbnail data', () => {
    component.url.setValue('cache:image-id');
    component.url.disable();

    expect(component.thumbnailRefs[0].url).toBe('cache:image-id');
  });

  it.each(['https://example.com/article', 'https://example.com/feed.xml'])(
    'does not proxy an unsaved page or feed URL for an empty thumbnail: %s',
    url => {
      vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag => {
        return ['plugin/thumbnail', 'plugin/image'].includes(tag) ? { config: { proxy: true } } as any : undefined;
      });
      vi.spyOn(component.admin, 'getEmbeds').mockReturnValue([]);
      const getFetch = vi.spyOn(TestBed.inject(ProxyService), 'getFetch').mockReturnValue('https://example.com/proxied.png');
      component.creating = true;
      component.url.setValue(url);
      component.url.disable();
      component.tags.push(new UntypedFormControl('plugin/thumbnail'));

      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.thumbnail-preview .thumbnail').style.backgroundImage).toBe('');
      expect(getFetch).not.toHaveBeenCalled();
    },
  );

  it('previews an explicit thumbnail without fetching the unsaved feed URL', () => {
    vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag => {
      return ['plugin/thumbnail', 'plugin/image'].includes(tag) ? { config: { proxy: true } } as any : undefined;
    });
    const getFetch = vi.spyOn(TestBed.inject(ProxyService), 'getFetch').mockReturnValue('https://example.com/proxied.png');
    component.creating = true;
    component.url.setValue('https://example.com/feed.xml');
    component.tags.push(new UntypedFormControl('plugin/thumbnail'));
    (component.group.get('plugins') as UntypedFormGroup).addControl('plugin/thumbnail', new UntypedFormControl({
      url: 'https://example.com/thumbnail.png',
    }));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.thumbnail-preview .thumbnail').style.backgroundImage)
      .toContain('https://example.com/proxied.png');
    expect(getFetch).toHaveBeenCalledWith('https://example.com/thumbnail.png', '', 'thumbnail', true);
    expect(getFetch).not.toHaveBeenCalledWith(component.url.value, expect.anything(), expect.anything(), expect.anything());
  });

  it.each(['plugin/image', 'plugin/video'])('still previews a recognized %s URL', plugin => {
    vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag => {
      return ['plugin/thumbnail', 'plugin/image', 'plugin/video'].includes(tag) ? { config: { proxy: true } } as any : undefined;
    });
    vi.spyOn(component.admin, 'getEmbeds').mockReturnValue([plugin]);
    const getFetch = vi.spyOn(TestBed.inject(ProxyService), 'getFetch').mockReturnValue('https://example.com/proxied.png');
    component.creating = true;
    component.url.setValue('https://example.com/media');
    component.tags.push(new UntypedFormControl('plugin/thumbnail'));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.thumbnail-preview .thumbnail').style.backgroundImage)
      .toContain('https://example.com/proxied.png');
    expect(getFetch).toHaveBeenCalledWith(component.url.value, '', 'thumbnail', true);
  });

  it('should extract title from filename when scrape returns no title', async () => {
    // Set a URL to a PDF file
    component.url.setValue('https://example.com/my-document.pdf');

    // Call scrapeTitle
    component.scrapeTitle();

    // Mock the scrape request to return empty title
    const req = httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'));
    req.flush({ url: 'https://example.com/my-document.pdf', title: undefined });

    // Mock the oembed request (it will fail)
    const oembedReq = httpMock.expectOne(request => request.url.includes('/api/v1/oembed'));
    oembedReq.flush(null, { status: 404, statusText: 'Not Found' });

    // Give the observable time to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that title was extracted from filename (with extension and separators preserved)
    expect(component.title.value).toBe('my-document.pdf');
  });

  it('should use scraped title when available', async () => {
    component.url.setValue('https://example.com/my-document.pdf');

    component.scrapeTitle();

    // Mock the scrape request to return a title
    const req = httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'));
    req.flush({ url: 'https://example.com/my-document.pdf', title: 'Scraped Title' });

    // Mock the oembed request (it will fail)
    const oembedReq = httpMock.expectOne(request => request.url.includes('/api/v1/oembed'));
    oembedReq.flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that scraped title was used instead of filename
    expect(component.title.value).toBe('Scraped Title');
  });
});
