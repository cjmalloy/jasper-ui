/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { InlineTagComponent } from './inline-tag.component';

describe('InlineTagComponent', () => {
  let component: InlineTagComponent;
  let fixture: ComponentFixture<InlineTagComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InlineTagComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(InlineTagComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefers a plugin over a template with the same tag', () => {
    vi.useFakeTimers();
    vi.spyOn(component['exts'], 'page').mockReturnValue(of({
      content: [],
      page: { totalElements: 0 },
    } as any));
    vi.spyOn(component['admin'], 'searchPlugins').mockReturnValue([{
      tag: 'same',
      name: 'Plugin',
    } as any]);
    vi.spyOn(component['admin'], 'searchTemplates').mockReturnValue([{
      tag: 'same',
      name: 'Template',
    } as any]);

    component.search({ value: 'same' } as HTMLInputElement);
    vi.advanceTimersByTime(400);

    expect(component.autocomplete).toEqual([{
      value: 'same',
      label: 'Plugin',
    }]);
    vi.useRealTimers();
  });
});
