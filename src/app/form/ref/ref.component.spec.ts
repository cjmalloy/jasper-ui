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

  it('does not proxy a new feed URL when its thumbnail is empty', () => {
    vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag =>
      ['plugin/thumbnail', 'plugin/image'].includes(tag) ? { config: { proxy: true } } as any : undefined);
    vi.spyOn(component.admin, 'getEmbeds').mockReturnValue([]);
    const getFetch = vi.spyOn(TestBed.inject(ProxyService), 'getFetch').mockReturnValue('proxy-thumbnail');
    component.creating = true;
    component.url.setValue('https://example.com/feed.xml');
    component.tags.push(new UntypedFormControl('plugin/script/feed'));
    component.tags.push(new UntypedFormControl('plugin/thumbnail'));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.thumbnail-preview .thumbnail')).not.toBeNull();
    expect(getFetch).not.toHaveBeenCalled();
  });

  it('still previews an explicit thumbnail while creating a feed', () => {
    vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag =>
      ['plugin/thumbnail', 'plugin/image'].includes(tag) ? { config: { proxy: true } } as any : undefined);
    const getFetch = vi.spyOn(TestBed.inject(ProxyService), 'getFetch').mockReturnValue('proxy-thumbnail');
    component.creating = true;
    component.url.setValue('https://example.com/feed.xml');
    component.tags.push(new UntypedFormControl('plugin/script/feed'));
    component.tags.push(new UntypedFormControl('plugin/thumbnail'));
    (component.group.get('plugins') as UntypedFormGroup).addControl(
      'plugin/thumbnail', new UntypedFormControl({ url: 'https://example.com/thumbnail.png' }));

    fixture.detectChanges();

    expect(getFetch).toHaveBeenCalledWith('https://example.com/thumbnail.png', '', 'thumbnail', true);
    expect(fixture.nativeElement.querySelector('.thumbnail').style.backgroundImage).toContain('proxy-thumbnail');
  });

  it('still previews cached image uploads while creating a Ref', () => {
    vi.spyOn(component.admin, 'getPlugin').mockImplementation(tag =>
      ['plugin/thumbnail', 'plugin/image'].includes(tag) ? {} as any : undefined);
    vi.spyOn(component.admin, 'getEmbeds').mockReturnValue(['plugin/image']);
    const getFetch = vi.spyOn(TestBed.inject(ProxyService), 'getFetch').mockReturnValue('proxy-thumbnail');
    component.creating = true;
    component.url.setValue('cache:image-id');
    component.tags.push(new UntypedFormControl('plugin/image'));

    fixture.detectChanges();

    expect(getFetch).toHaveBeenCalledWith('cache:image-id', '', 'thumbnail', true);
    expect(fixture.nativeElement.querySelector('.thumbnail').style.backgroundImage).toContain('proxy-thumbnail');
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
