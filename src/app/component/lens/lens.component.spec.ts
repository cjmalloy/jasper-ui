/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { runInAction } from 'mobx';

import { LensComponent } from './lens.component';

describe('LensComponent', () => {
  let component: LensComponent;
  let fixture: ComponentFixture<LensComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LensComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
    });
    await TestBed.compileComponents();

    fixture = TestBed.createComponent(LensComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([
    ['sourcesOf', '.sources-of'],
    ['responseOf', '.responses-of'],
  ] as const)('reacts when query.%s loads', async (property, selector) => {
    expect(fixture.nativeElement.querySelector(selector)).toBeNull();

    runInAction(() => component.query[property] = {
      url: 'https://example.com/ref',
      title: 'Filtered ref',
    });

    await vi.waitFor(() => {
      expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
    });
  });
});
