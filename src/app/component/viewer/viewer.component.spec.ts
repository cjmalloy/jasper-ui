/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { MarkdownModule } from 'ngx-markdown';

import { AuthzService } from '../../service/authz.service';
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

  it('should only expose authorized actions for a saved Ref', () => {
    const auth = TestBed.inject(AuthzService);
    vi.spyOn(auth, 'writeAccess').mockReturnValue(false);
    vi.spyOn(auth, 'taggingAccess').mockReturnValue(false);
    vi.spyOn(auth, 'hasRole').mockReturnValue(false);
    component.ref = { url: 'https://example.com', modified: DateTime.now() };

    expect(Object.keys(component.uiActions)).toEqual(['event', 'watch']);
  });

  it('should expose writable and user actions when authorized', () => {
    const auth = TestBed.inject(AuthzService);
    vi.spyOn(auth, 'writeAccess').mockReturnValue(true);
    vi.spyOn(auth, 'taggingAccess').mockReturnValue(true);
    vi.spyOn(auth, 'hasRole').mockReturnValue(true);
    component.ref = { url: 'https://example.com', modified: DateTime.now() };

    expect(Object.keys(component.uiActions).sort()).toEqual([
      'append', 'comment', 'emit', 'event', 'plugin', 'respond', 'tag', 'update', 'watch',
    ]);
  });

  it('should keep user actions separate from write and tagging access', () => {
    const auth = TestBed.inject(AuthzService);
    vi.spyOn(auth, 'writeAccess').mockReturnValue(false);
    vi.spyOn(auth, 'taggingAccess').mockReturnValue(false);
    vi.spyOn(auth, 'hasRole').mockReturnValue(true);
    component.ref = { url: 'https://example.com', modified: DateTime.now() };

    expect(Object.keys(component.uiActions).sort()).toEqual(['emit', 'event', 'respond', 'watch']);
  });
});
