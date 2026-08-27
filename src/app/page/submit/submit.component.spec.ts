/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';
import { Page } from '../../model/page';
import { RefService } from '../../service/api/ref.service';

import { SubmitPage } from './submit.component';

describe('SubmitPage', () => {
  let component: SubmitPage;
  let fixture: ComponentFixture<SubmitPage>;
  let refs: RefService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        forwardRef(() => SubmitPage),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            snapshot: { params: {}, queryParams: {} }
          }
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitPage);
    component = fixture.componentInstance;
    refs = TestBed.inject(RefService);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function resolveExists(url: string) {
    vi.useFakeTimers();
    const result = firstValueFrom(component.exists(url));
    await vi.advanceTimersByTimeAsync(400);
    return result;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports an existing ref after loading its responses', async () => {
    const url = 'https://www.youtube.com/@existing';
    const existing = { url, origin: '' };
    const responses = Page.of([{ url: 'internal:response', origin: '', sources: [url] }]);
    vi.spyOn(refs, 'page')
      .mockReturnValueOnce(of(Page.of([existing])))
      .mockReturnValueOnce(of(responses));

    await expect(resolveExists(url)).resolves.toBe(true);
    expect(component.existingRef).toBe(existing);
    expect(component.responsesToUrl).toBe(responses);
    expect(component.responsesToUrlFor).toBe(url);
  });

  it('reports a missing ref while retaining its responses', async () => {
    const url = 'https://www.youtube.com/@missing';
    const responses = Page.of([{ url: 'internal:response', origin: '', sources: [url] }]);
    vi.spyOn(refs, 'page')
      .mockReturnValueOnce(of(Page.of([])))
      .mockReturnValueOnce(of(responses));

    await expect(resolveExists(url)).resolves.toBe(false);
    expect(component.existingRef).toBeUndefined();
    expect(component.responsesToUrl).toBe(responses);
    expect(component.responsesToUrlFor).toBe(url);
  });

  it('keeps an existing result when loading responses fails', async () => {
    const url = 'https://www.youtube.com/@existing';
    vi.spyOn(refs, 'page')
      .mockReturnValueOnce(of(Page.of([{ url, origin: '' }])))
      .mockReturnValueOnce(throwError(() => new Error('Failed to load responses')));

    await expect(resolveExists(url)).resolves.toBe(true);
  });
});
