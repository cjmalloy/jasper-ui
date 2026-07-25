/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';

import { Ref } from '../../model/ref';
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

  it('should bind plugin actions to a new unsaved ref', () => {
    const first = { url: 'internal:first', tags: ['plugin/jezzball'] } as Ref;
    const second = { url: 'internal:second', tags: ['plugin/jezzball'] } as Ref;
    component.ref = first;
    component.ngOnChanges({ ref: new SimpleChange(undefined, first, true) });
    const firstActions = component.uiActions;

    component.ref = second;
    component.ngOnChanges({ ref: new SimpleChange(first, second, false) });
    component.uiActions.plugin!('plugin/jezzball', { level: 1 });

    expect(component.uiActions).not.toBe(firstActions);
    expect(first.plugins).toBeUndefined();
    expect(second.plugins).toEqual({ 'plugin/jezzball': { level: 1 } });
  });
});
