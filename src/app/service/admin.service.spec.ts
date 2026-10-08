/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { AdminService } from './admin.service';

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

  it('should not inherit template admin forms', () => {
    service.status.templates['parent'] = { tag: 'parent', config: { adminForm: [{ key: 'a' }], advancedAdminForm: [{ key: 'b' }] } };
    service.status.templates['parent/child'] = { tag: 'parent/child', config: { adminForm: [{ key: 'c' }] } };
    expect(service.getTemplateAdminForm('parent/child').map(f => f.key)).toEqual(['c']);
    expect(service.getTemplateAdminForm('parent/child', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('parent', 'advancedAdminForm').map(f => f.key)).toEqual(['b']);
  });

  it('should fall back to hard coded config admin forms', () => {
    expect(service.getTemplateAdminForm('_config/index').map(f => f.key)).toContain('fulltext');
    expect(service.getTemplateAdminForm('_config/security').map(f => f.key)).toContain('minRole');
    expect(service.getTemplateAdminForm('_config/server').map(f => f.key)).toContain('scriptSelectors');
    expect(service.getTemplateAdminForm('_config/server/worker').map(f => f.key)).toContain('scriptSelectors');
    expect(service.getTemplateAdminForm('_config/server', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('_config/other')).toEqual([]);
    service.status.templates['_config/server'] = { tag: '_config/server', config: { adminForm: [{ key: 'a' }] } };
    expect(service.getTemplateAdminForm('_config/server').map(f => f.key)).toEqual(['a']);
  });

  it('should add a markdown editor for ai instructions', () => {
    service.status.plugins['plugin/test'] = { tag: 'plugin/test', config: { aiInstructions: '# test' } } as any;
    service.status.plugins['plugin/script'] = { tag: 'plugin/script', config: { aiInstructions: '# test', adminForm: [{ key: 'script' }] } } as any;
    service.status.templates['test'] = { tag: 'test', config: { aiInstructions: '# test' } };
    expect(service.getPluginAdminForm('plugin/test').map(f => [f.key, f.type])).toEqual([['aiInstructions', 'editor']]);
    expect(service.getPluginAdminForm('plugin/script').map(f => f.key)).toEqual(['script', 'aiInstructions']);
    expect(service.getPluginAdminForm('plugin/test', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('test').map(f => f.key)).toEqual(['aiInstructions']);
  });

  it('should keep formly expressions serializable for built-in mods', () => {
    expect(userTemplate.config?.form?.find(f => f.key === 'subscriptions')?.expressions?.hide).toBe('!formState.admin.home');
    expect(blogTemplate.config?.form?.find(f => f.key === 'tags')?.expressions?.hide).toBe('!field.parent.model.filterTags');
    expect(llmPlugin.config?.advancedForm?.find(f => f.key === 'bundle')?.expressions?.hide).toBe('!model.json');
    expect(scrapePlugin.config?.form?.find(f => f.key === 'textSelectors')?.expressions?.hide).toBe('!field.parent.model.text');
  });

  it('should not mutate installed plugin icons or buttons', () => {
    const icon = { label: '🧪️' };
    const button = { label: '🧪️', ribbon: true };
    service.status.plugins['plugin/test'] = {
      tag: 'plugin/test',
      name: 'Test',
      config: { icons: [icon], editorButtons: [button] },
    } as any;
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
