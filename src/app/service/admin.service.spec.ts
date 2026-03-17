/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { RefService } from './api/ref.service';
import { AdminService, equalBundle } from './admin.service';
import { Store } from '../store/store';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should keep formly expressions serializable for built-in mods', () => {
    expect(userTemplate.config?.form?.find(f => f.key === 'subscriptions')?.expressions?.hide).toBe('!formState.admin.home');
    expect(blogTemplate.config?.form?.find(f => f.key === 'tags')?.expressions?.hide).toBe('!field.parent.model.filterTags');
    expect(llmPlugin.config?.advancedForm?.find(f => f.key === 'bundle')?.expressions?.hide).toBe('!model.json');
    expect(scrapePlugin.config?.form?.find(f => f.key === 'textSelectors')?.expressions?.hide).toBe('!field.parent.model.text');
  });

  it('should create a mod ref containing the installed bundle', () => {
    const refs = TestBed.inject(RefService);
    const store = TestBed.inject(Store);
    store.account.origin = '@local';
    vi.spyOn(refs, 'get').mockReturnValue(throwError(() => ({ status: 404 })));
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('ok'));

    service.logModReceipt$('Wiki', {
      plugin: [{ tag: 'plugin/wiki', name: 'Wiki' } as any],
    }, () => {}).subscribe();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'internal:mod/Wiki',
      origin: '@local',
      title: 'Wiki',
      tags: ['internal', 'plugin/mod/receipt'],
      plugins: {
        'plugin/mod': {
          plugin: [{ tag: 'plugin/wiki', name: 'Wiki' }],
        },
      },
    }));
  });

  it('should find loaded mod refs by title when url ids are sanitized', () => {
    const refs = TestBed.inject(RefService);
    const store = TestBed.inject(Store);
    store.account.origin = '@local';
    vi.spyOn(refs, 'page').mockReturnValue(of({
      content: [{
        url: 'mod:Wiki',
        origin: '@local',
        title: '📔️ Wiki',
        plugins: { 'plugin/mod': { template: [{ tag: 'config/wiki', config: { mod: '📔️ Wiki' } }] } },
      }],
      page: { totalPages: 1 },
    } as any));

    (service as any).loadModRefs$().subscribe();

    expect(service.getInstalledMod('📔️ Wiki')).toEqual(expect.objectContaining({
      template: [{ tag: 'config/wiki', config: { mod: '📔️ Wiki' } }],
    }));
  });

  it('should ignore extra live entries that share a mod id but are not in the installed receipt', () => {
    service.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    } as any;
    service.status.plugins['plugin/wiki-extra'] = {
      tag: 'plugin/wiki-extra',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    } as any;
    service.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/wiki',
            config: { mod: 'Wiki', version: 1 },
          }],
        },
      },
    } as any;

    expect(service.getCurrentMod('Wiki').plugin?.map(plugin => plugin.tag)).toEqual(['plugin/wiki']);
  });

  it('should prefer exact internal receipt ids over legacy title matches', () => {
    service.status.modRefs['Wiki-Legacy'] = {
      url: 'mod:Wiki-Legacy',
      title: 'Wiki',
      origin: '@local',
      plugins: { 'plugin/mod': { plugin: [{ tag: 'plugin/wiki-legacy', config: { mod: 'Wiki' } }] } },
    } as any;
    service.status.modRefs.Wiki = {
      url: 'internal:mod/Wiki',
      title: 'Wiki',
      origin: '@local',
      plugins: { 'plugin/mod': { plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki' } }] } },
    } as any;

    expect(service.getInstalledMod('Wiki')).toEqual(expect.objectContaining({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki' } }],
    }));
  });

  it('should compare plugin-only receipts without treating empty template arrays as modifications', () => {
    const bundle = {
      plugin: [{
        tag: 'plugin/mod',
        name: '🎁️ Mod',
        config: { mod: '🎁️ Store', version: 1 },
      }],
    };
    service.status.plugins['plugin/mod'] = {
      tag: 'plugin/mod',
      origin: '@local',
      name: '🎁️ Mod',
      config: { mod: '🎁️ Store', version: 1 },
    } as any;
    service.status.modRefs['🎁️ Store'] = {
      url: 'internal:mod/%F0%9F%8E%81%EF%B8%8F%20Store',
      title: '🎁️ Store',
      origin: '@local',
      plugins: { 'plugin/mod': bundle },
    } as any;

    expect(equalBundle(service.getCurrentMod('🎁️ Store'), service.getInstalledMod('🎁️ Store'))).toBe(true);
  });

  it('should clear loaded mod refs found by title when deleting a mod', () => {
    const refs = TestBed.inject(RefService);
    const remove = vi.spyOn(refs, 'delete').mockReturnValue(of(void 0));
    service.status.modRefs['Wiki-Receipt'] = {
      url: 'internal:mod/Wiki-Receipt',
      title: '📔️ Wiki',
      origin: '@local',
      plugins: { 'plugin/mod': { template: [{ tag: 'config/wiki', config: { mod: '📔️ Wiki' } }] } },
    } as any;

    service.deleteMod$('📔️ Wiki', () => {}).subscribe();

    expect(remove).toHaveBeenCalledWith('internal:mod/Wiki-Receipt', '@local');
    expect(service.status.modRefs['Wiki-Receipt']).toBeUndefined();
  });

});
