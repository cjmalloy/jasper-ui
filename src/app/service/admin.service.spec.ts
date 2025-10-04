import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { AdminService } from './admin.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { Plugin } from '../model/plugin';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should extract sub-tags from tags with tagForm plugins', () => {
    // Setup a mock plugin with tagForm
    const cronPlugin: Plugin = {
      tag: '+plugin/cron',
      name: 'Scheduler',
      config: {
        tagForm: [[{
          key: 'interval',
          type: 'duration'
        }]]
      }
    };

    // Mock the plugin status
    service.status.plugins['+plugin/cron'] = cronPlugin;

    // Test getPluginTagForms
    const tags = ['+plugin/cron/pt15m', 'some/other/tag'];
    const tagForms = service.getPluginTagForms(tags);

    expect(tagForms.length).toBe(1);
    expect(tagForms[0].plugin.tag).toBe('+plugin/cron');
    expect(tagForms[0].tag).toBe('+plugin/cron/pt15m');
    expect(tagForms[0].formIndex).toBe(0);
    expect(tagForms[0].subTag).toBe('pt15m');
  });
});
