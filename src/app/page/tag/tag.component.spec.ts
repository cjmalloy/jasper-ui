/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { runInAction } from 'mobx';

import { TagPage } from './tag.component';

describe('TagPage', () => {
  let component: TagPage;
  let fixture: ComponentFixture<TagPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => TagPage)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should include internal refs for an origin-qualified plugin query', () => {
    runInAction(() => component.store.view.route.routeSnapshot = {
      queryParams: {},
      firstChild: {
        params: { tag: 'plugin/test@remote' },
        url: [{ path: 'tag' }],
      },
    } as any);
    const getPlugins = vi.spyOn(component.admin, 'getPlugins').mockReturnValue([{} as any]);

    fixture.detectChanges();

    expect(getPlugins).toHaveBeenCalledWith(['plugin/test']);
    expect(component.query.args?.query).not.toContain('!internal');
  });
});
