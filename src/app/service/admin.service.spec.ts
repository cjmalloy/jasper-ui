/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { RefService } from './api/ref.service';
import { AdminService } from './admin.service';
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
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('ok'));

    service.install$('Wiki', {
      plugin: [{ tag: 'plugin/wiki', name: 'Wiki' } as any],
    }, () => {}).subscribe();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'mod:plugin/wiki',
      origin: '@local',
      title: 'Wiki',
      tags: ['public', 'plugin/mod'],
      plugins: {
        'plugin/mod': {
          plugin: [{ tag: 'plugin/wiki', name: 'Wiki' }],
        },
      },
    }));
  });
});
