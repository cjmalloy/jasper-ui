import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';
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
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RefFormComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    component.group = new UntypedFormGroup({
      url: new UntypedFormControl(),
      published: new UntypedFormControl(),
      title: new UntypedFormControl(),
      comment: new UntypedFormControl(),
      sources: new UntypedFormControl(),
      alternateUrls: new UntypedFormControl(),
      tags: new UntypedFormControl(),
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
