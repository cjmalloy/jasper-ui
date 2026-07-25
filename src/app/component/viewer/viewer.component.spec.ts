/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { Plugin } from '../../model/plugin';
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

  it('keeps an ignored plugin running when its Ref updates', () => {
    const previous = { url: 'https://example.com/game', origin: '', modifiedString: '1' } as Ref;
    const current = { ...previous, modifiedString: '2' } as Ref;
    vi.spyOn(component.admin, 'getPluginUi').mockReturnValue([
      { config: { ignoreUpdates: true } } as Plugin,
    ]);
    const init = vi.spyOn(component, 'init');

    component.ngOnChanges({
      ref: new SimpleChange(previous, current, false),
      tags: new SimpleChange(['plugin/jezzball'], ['plugin/jezzball', 'plugin/score'], false),
    });

    expect(init).not.toHaveBeenCalled();
  });
});
