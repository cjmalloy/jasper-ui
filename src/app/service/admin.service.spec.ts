/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { ORIGIN_WILDCARD_REGEX, TAG_ORIGIN_SELECTOR_REGEX } from '../util/format';
import { defer, firstValueFrom, of } from 'rxjs';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { PluginService } from './api/plugin.service';
import { TemplateService } from './api/template.service';
import { ConfigService } from './config.service';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it.each([
    ['_config/security', 'per origin'],
    ['_config/server', 'global'],
  ])('should add maxRequestsPeriod after maxRequests in %s', (tag, scope) => {
    const form = service.getTemplateAdminForm(tag);
    const keys = form.map(f => f.key);
    const index = keys.indexOf('maxRequests');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(keys[index + 1]).toBe('maxRequestsPeriod');
    expect(form[index].props?.label).toContain(scope);
    const period = form[index + 1];
    expect(period.type).toBe('duration');
    expect(period.props?.hint).toContain('unlimited');
    expect(period.props?.datalist.map((o: any) => o.value)).toEqual(
      expect.arrayContaining(['PT0.0000005S', 'PT0.1S', 'PT1S', 'PT10S', 'PT1M', 'PT1H']));
  });

  it('should not install default mods when installDefaults is disabled', async () => {
    TestBed.inject(ConfigService).installDefaults = false;
    TestBed.inject(Store).account.admin = true;
    const create = vi.spyOn(TestBed.inject(PluginService), 'create');
    await firstValueFrom(service.firstRun$);
    expect(create).not.toHaveBeenCalled();
  });

  it('should install default mods for an admin on an empty origin', () => {
    TestBed.inject(Store).account.admin = true;
    const create = vi.spyOn(TestBed.inject(PluginService), 'create').mockReturnValue(of(null as any));
    service.firstRun$;
    expect(create).toHaveBeenCalled();
  });

  it('should load defaults after installing default mods', () => {
    const store = TestBed.inject(Store);
    store.account.admin = true;
    const calls: string[] = [];
    vi.spyOn(TestBed.inject(PluginService), 'create').mockImplementation(() => defer(() => {
      calls.push('install');
      return of(null as any);
    }));
    vi.spyOn(TestBed.inject(TemplateService), 'create').mockImplementation(() => defer(() => {
      calls.push('install');
      return of(null as any);
    }));
    store.eventBus.events.subscribe(({ event }) => {
      if (event === '*:defaults') calls.push('defaults');
    });
    vi.spyOn(service, 'init$', 'get').mockReturnValue(of(null));
    service.firstRun$.subscribe();
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.indexOf('defaults')).toBe(calls.length - 1);
  });

  it('should only list PDF embeds that will embed', () => {
    (service as any).updateStatus((status: any) => {
      status.plugins['plugin/pdf'] = { tag: 'plugin/pdf', config: { embeddable: true, proxy: false } };
    });
    const external = { url: 'https://example.com/paper.pdf', tags: ['plugin/pdf/scanned'] };
    const cached = { url: 'cache:abc', tags: ['plugin/pdf/scanned'] };
    expect(service.getEmbeds(external)).toEqual([]);
    expect(service.getEmbeds(cached)).toEqual(['plugin/pdf/scanned']);
    (service as any).updateStatus((status: any) => {
      status.plugins['plugin/pdf'] = { tag: 'plugin/pdf', config: { embeddable: true, proxy: true } };
    });
    expect(service.getEmbeds(external)).toEqual(['plugin/pdf/scanned']);
  });

  it('should not inherit template admin forms', () => {
    (service as any).updateStatus((status: any) => {
      status.templates['parent'] = { tag: 'parent', config: { adminForm: [{ key: 'a' }], advancedAdminForm: [{ key: 'b' }] } };
      status.templates['parent/child'] = { tag: 'parent/child', config: { adminForm: [{ key: 'c' }] } };
    });
    expect(service.getTemplateAdminForm('parent/child').map(f => f.key)).toEqual(['c']);
    expect(service.getTemplateAdminForm('parent/child', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('parent', 'advancedAdminForm').map(f => f.key)).toEqual(['b']);
  });

  it('should fall back to hard coded config admin forms', () => {
    expect(service.getTemplateAdminForm('_config/index').map(f => f.key)).toEqual([
      'tags', 'sources', 'alts', 'responses', 'internalResponses', 'fulltext', 'published', 'modified',
      'ignored', 'cascade', 'regen', 'hotTags',
    ]);
    expect(service.getTemplateAdminForm('_config/security').map(f => f.key)).toContain('minRole');
    expect(service.getTemplateAdminForm('_config/server').map(f => f.key)).toContain('scriptSelectors');
    expect(service.getTemplateAdminForm('_config/server/worker').map(f => f.key)).toContain('scriptSelectors');
    expect(service.getTemplateAdminForm('_config/server', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('_config/other')).toEqual([]);
    (service as any).updateStatus((status: any) => {
      status.templates['_config/server'] = { tag: '_config/server', config: { adminForm: [{ key: 'a' }] } };
    });
    expect(service.getTemplateAdminForm('_config/server').map(f => f.key)).toEqual(['a']);
  });

  it('should allow wildcard web origins in the server config fallback form', () => {
    const webOrigins = service.getTemplateAdminForm('_config/server').find(f => f.key === 'webOrigins')!;
    expect(webOrigins.type).toBe('originSelectorList');
    for (const value of ['', '@', '@*', '@company', '@company.*', '@a.b.*']) {
      expect(ORIGIN_WILDCARD_REGEX.test(value)).toBe(true);
    }
    for (const value of ['*', '@.*', '@company.', '@company*', 'company']) {
      expect(ORIGIN_WILDCARD_REGEX.test(value)).toBe(false);
    }
  });

  it('should allow wildcard origins but not negation in script selectors in the server config fallback form', () => {
    const scriptSelectors = service.getTemplateAdminForm('_config/server').find(f => f.key === 'scriptSelectors')!;
    expect(scriptSelectors.type).toBe('tagOriginSelectors');
    for (const value of ['', '@', '@origin', 'plugin/script', 'plugin/script@', 'plugin/script@a.b', '+plugin/cron@origin',
      '@*', '@origin.*', '@a.b.*', 'plugin/script@*', '_plugin/delta/scrape@navi.*']) {
      expect(TAG_ORIGIN_SELECTOR_REGEX.test(value)).toBe(true);
    }
    for (const value of ['*', 'plugin/*', '@.*', '@origin*', '@origin.', '@*.origin', '!plugin/script', '!@origin', '@.origin']) {
      expect(TAG_ORIGIN_SELECTOR_REGEX.test(value)).toBe(false);
    }
  });

  it('should include a markdown editor for ai instructions in built-in mods', () => {
    expect(userTemplate.config?.adminForm?.find(f => f.key === 'aiInstructions')?.type).toBe('editor');
  });

  it('should keep formly expressions serializable for built-in mods', () => {
    expect(userTemplate.config?.form?.find(f => f.key === 'subscriptions')?.expressions?.hide).toBe('!formState.admin.hasHome');
    expect(blogTemplate.config?.form?.find(f => f.key === 'tags')?.expressions?.hide).toBe('!field.parent.model.filterTags');
    expect(llmPlugin.config?.advancedForm?.find(f => f.key === 'bundle')?.expressions?.hide).toBe('!model.json');
    expect(scrapePlugin.config?.form?.find(f => f.key === 'textSelectors')?.expressions?.hide).toBe('!field.parent.model.text');
  });

  it('should not mutate installed plugin icons or buttons', () => {
    const icon = { label: '🧪️' };
    const button = { label: '🧪️', ribbon: true };
    (service as any).updateStatus((status: any) => status.plugins['plugin/test'] = {
      tag: 'plugin/test',
      name: 'Test',
      config: { icons: [icon], editorButtons: [button] },
    });
    const icons = service.getIcons(['plugin/test']);
    expect(icons.length).toBe(1);
    expect(icons[0].tag).toBe('plugin/test');
    expect(icons[0].title).toBe('Test');
    expect(icons[0]._parent?.tag).toBe('plugin/test');
    expect(icon).toEqual({ label: '🧪️' });
    const buttons = service.getEditorButtons(['plugin/test']);
    expect(buttons[0].toggle).toBe('plugin/test');
    expect(button).toEqual({ label: '🧪️', ribbon: true });
  });
});
