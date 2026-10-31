/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { provideJasperFormly } from '../../formly/formly.config';
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
        RefFormComponent
      ],
      providers: [
        provideJasperFormly(),
        PluginsFormComponent,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('group', new UntypedFormGroup({
      url: new UntypedFormControl(),
      published: new UntypedFormControl(),
      title: new UntypedFormControl(),
      comment: new UntypedFormControl(),
      sources: new UntypedFormArray([]),
      alternateUrls: new UntypedFormArray([]),
      tags: new UntypedFormArray([]),
      plugins: new UntypedFormGroup({}),
    }));
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
    component.tags().push(new UntypedFormControl('plugin/thumbnail'));

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.thumbnail-preview')).toBeNull();

    fixture.componentRef.setInput('creating', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.thumbnail-preview .thumbnail')).not.toBeNull();
  });

  it('includes the disabled URL in creation thumbnail data', () => {
    component.url().setValue('cache:image-id');
    component.url().disable();

    expect(component.thumbnailRefs()[0].url).toBe('cache:image-id');
  });

  it('should extract title from filename when scrape returns no title', async () => {
    // Set a URL to a PDF file
    component.url().setValue('https://example.com/my-document.pdf');

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
    expect(component.title().value).toBe('my-document.pdf');
  });

  it('should use scraped title when available', async () => {
    component.url().setValue('https://example.com/my-document.pdf');

    component.scrapeTitle();

    // Mock the scrape request to return a title
    const req = httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'));
    req.flush({ url: 'https://example.com/my-document.pdf', title: 'Scraped Title' });

    // Mock the oembed request (it will fail)
    const oembedReq = httpMock.expectOne(request => request.url.includes('/api/v1/oembed'));
    oembedReq.flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that scraped title was used instead of filename
    expect(component.title().value).toBe('Scraped Title');
  });

  it('should not replace an edited title when scraping automatically', async () => {
    component.url().setValue('https://example.com/page');
    component.title().setValue('My Title');
    component.title().markAsDirty();

    component.scrapeTitle();

    httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'))
      .flush({ url: 'https://example.com/page', title: 'Scraped Title' });
    httpMock.expectOne(request => request.url.includes('/api/v1/oembed'))
      .flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(component.title().value).toBe('My Title');
  });

  it('should replace an edited title when scraping explicitly', async () => {
    component.url().setValue('https://example.com/page');
    component.title().setValue('My Title');
    component.title().markAsDirty();

    component.scrapeTitle(true);

    httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'))
      .flush({ url: 'https://example.com/page', title: 'Scraped Title' });
    httpMock.expectOne(request => request.url.includes('/api/v1/oembed'))
      .flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(component.title().value).toBe('Scraped Title');
  });

  it('should not replace a title edited while an explicit scrape is pending', async () => {
    component.url().setValue('https://example.com/page');

    component.scrapeTitle(true);
    component.title().setValue('Typed While Pending');
    component.title().markAsDirty();

    httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'))
      .flush({ url: 'https://example.com/page', title: 'Scraped Title' });
    httpMock.expectOne(request => request.url.includes('/api/v1/oembed'))
      .flush(null, { status: 404, statusText: 'Not Found' });

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(component.title().value).toBe('Typed While Pending');
  });

  it('scrapes plugins from a source that was just added', () => {
    const channel = 'https://www.youtube.com/@channel';
    component.url().setValue('https://www.youtube.com/feeds/videos.xml?channel_id=abc');
    component.tagsFormComponent().addTag('plugin/repost');
    component.sourcesFormComponent().addLink(channel);

    component.scrapePlugins(channel);

    const req = httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'));
    expect(req.request.params.get('url')).toBe(channel);
    req.flush({ url: channel, tags: [], plugins: { 'plugin/thumbnail': { url: 'https://yt3.example/thumb.jpg' } } });

    expect(component.ref()?.plugins?.['plugin/thumbnail']).toEqual({ url: 'https://yt3.example/thumb.jpg' });
  });

  it('merges plugin defaults under scraped plugins', () => {
    const channel = 'https://www.youtube.com/@channel';
    component.url().setValue('https://www.youtube.com/feeds/videos.xml?channel_id=abc');
    component.tagsFormComponent().addTag('plugin/repost');
    component.sourcesFormComponent().addLink(channel);

    component.scrapePlugins(channel, { 'plugin/thumbnail': { radius: 24 } });

    httpMock.expectOne(request => request.url.includes('/api/v1/scrape/web'))
      .flush({ url: channel, tags: [], plugins: { 'plugin/thumbnail': { url: 'https://yt3.example/thumb.jpg' } } });

    expect(component.ref()?.plugins?.['plugin/thumbnail']).toEqual({ url: 'https://yt3.example/thumb.jpg', radius: 24 });
  });
});
