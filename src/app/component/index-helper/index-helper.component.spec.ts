/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { TemplateService } from '../../service/api/template.service';
import { AuthzService } from '../../service/authz.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { RefPageArgs } from '../../model/ref';

import { IndexHelperComponent } from './index-helper.component';

describe('IndexHelperComponent', () => {
  const args = signal<RefPageArgs | undefined>(undefined);
  let admin = false;
  let templates: { get: ReturnType<typeof vi.fn>, merge: ReturnType<typeof vi.fn> };
  const index: Template = {
    tag: '_config/index',
    origin: '',
    modifiedString: '2026-01-01T00:00:00.000Z',
    config: { hotTags: ['public'] },
  } as Template;

  function create(origin = '') {
    TestBed.configureTestingModule({
      imports: [IndexHelperComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AdminService, useValue: { getTemplate: () => ({ tag: '_index.helper' }) } },
        { provide: AuthzService, useValue: { hasRole: () => admin } },
        { provide: QueryStore, useValue: { args } },
        { provide: TemplateService, useValue: templates },
      ],
    });
    TestBed.inject(Store).account.origin.set(origin);
    const fixture = TestBed.createComponent(IndexHelperComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    admin = false;
    args.set({ sort: ['tags->plugin/title'] });
    templates = {
      get: vi.fn(() => of(index)),
      merge: vi.fn(() => of(undefined)),
    };
  });

  it('reads the root _config/index', async () => {
    const fixture = create();
    await fixture.whenStable();
    expect(templates.get).toHaveBeenCalledWith('_config/index');
    expect(fixture.componentInstance.missing().hotTags).toEqual(['plugin/title']);
  });

  it('admin can fix the root _config/index', async () => {
    admin = true;
    const fixture = create();
    await fixture.whenStable();
    expect(fixture.componentInstance.canFix()).toBe(true);
    fixture.componentInstance.fix();
    expect(templates.merge).toHaveBeenCalledWith('_config/index', index.modifiedString, {
      config: { hotTags: ['public', 'plugin/title'] },
    });
  });

  it('cannot fix without reading _config/index', async () => {
    admin = true;
    templates.get = vi.fn(() => of(null));
    const fixture = create();
    await fixture.whenStable();
    expect(fixture.componentInstance.canFix()).toBe(false);
    expect(fixture.componentInstance.missing().hotTags).toEqual(['plugin/title']);
  });

  it('cannot fix a disabled _config/index', async () => {
    admin = true;
    templates.get = vi.fn(() => of({ ...index, config: { disabled: true, hotTags: ['plugin/title'] } }));
    const fixture = create();
    await fixture.whenStable();
    expect(fixture.componentInstance.disabled()).toBe(true);
    expect(fixture.componentInstance.canFix()).toBe(false);
    expect(fixture.componentInstance.missing().hotTags).toEqual(['plugin/title']);
  });

  it('only requests indices in a tenant origin', async () => {
    admin = true;
    const fixture = create('@tenant');
    await fixture.whenStable();
    expect(templates.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.canFix()).toBe(false);
    expect(fixture.componentInstance.fixable()).toBe(true);
  });

  it('reports vote sorts as not indexed', async () => {
    admin = true;
    args.set({ sort: ['plugins->plugin/user/vote:score,DESC'] });
    const fixture = create();
    await fixture.whenStable();
    expect(templates.get).not.toHaveBeenCalled();
    expect(fixture.componentInstance.show()).toBe(true);
    expect(fixture.componentInstance.anyMissing()).toBe(true);
    expect(fixture.componentInstance.fixable()).toBe(false);
    expect(fixture.nativeElement.querySelector('.index-status').textContent).toContain('Not indexed');
    expect(fixture.nativeElement.querySelector('.fix-indexes, .request-indexes')).toBeNull();
  });

  it('admin can add a hot plugin for a plugin sort', async () => {
    admin = true;
    args.set({ sort: ['plugins->plugin/test->size:num,DESC'] });
    const fixture = create();
    await fixture.whenStable();
    expect(fixture.componentInstance.missing().hotPlugins).toEqual(['plugin/test->size:num']);
    expect(fixture.componentInstance.canFix()).toBe(true);
    fixture.componentInstance.fix();
    expect(templates.merge).toHaveBeenCalledWith('_config/index', index.modifiedString, {
      config: { hotPlugins: ['plugin/test->size:num'] },
    });
  });

  it('shows nothing for queries without indices', async () => {
    args.set({});
    const fixture = create();
    await fixture.whenStable();
    expect(fixture.componentInstance.show()).toBe(false);
    expect(templates.get).not.toHaveBeenCalled();
  });
});
