/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { jezzballMod, jezzballPlugin, jezzballTemplate } from '../mods/games/jezzball';
import { scoreMod, scorePlugin } from '../mods/games/score';
import { skiFreeMod, skiFreePlugin } from '../mods/games/skifree';
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

  it('shares one score definition and sort across both games', () => {
    expect(service.getMod(scorePlugin.config!.mod!)).toBe(scoreMod);
    expect(service.getMod(jezzballPlugin.config!.mod!)).toBe(jezzballMod);
    expect(service.getMod(skiFreePlugin.config!.mod!)).toBe(skiFreeMod);
    expect(jezzballMod.plugin).toContain(scorePlugin);
    expect(skiFreeMod.plugin).toContain(scorePlugin);
    const sorts = Object.values(service.def.plugins).flatMap(p => p.config?.sorts || []);
    expect(sorts.filter(s => s.sort === 'plugins->plugin/score:num')).toHaveLength(1);
  });

  it('includes shared plugins in installed game bundles without treating score alone as a game', () => {
    service.status.plugins = { 'plugin/score': scorePlugin };
    expect(service.getInstalledMod(skiFreePlugin.config!.mod!)).toBeUndefined();
    service.status.plugins['plugin/skifree'] = skiFreePlugin;
    expect(service.getInstalledMod(skiFreePlugin.config!.mod!)?.plugin).toEqual([scorePlugin, skiFreePlugin]);
    expect(service.getInstalledMod(scorePlugin.config!.mod!)?.plugin).toEqual([scorePlugin]);
  });

  it.each([scorePlugin, jezzballPlugin])('removes only $tag when the installed score still belongs to JezzBall', plugin => {
    const legacyScore = {
      ...scorePlugin,
      config: { ...scorePlugin.config, mod: jezzballPlugin.config!.mod, version: 1 },
    };
    service.status.plugins = {
      [legacyScore.tag]: legacyScore,
      [jezzballPlugin.tag]: jezzballPlugin,
      [skiFreePlugin.tag]: skiFreePlugin,
    };
    service.status.templates = { [jezzballTemplate.tag]: jezzballTemplate };
    const deletePlugin = vi.spyOn(service, 'deletePlugin$').mockReturnValue(of(null));
    const deleteTemplate = vi.spyOn(service, 'deleteTemplate$').mockReturnValue(of(null));

    service.deleteMod$(plugin.config!.mod!, () => {}).subscribe(() => {});

    expect(deletePlugin.mock.calls.map(([p]) => p.tag)).toEqual([plugin.tag]);
    expect(deleteTemplate.mock.calls.map(([t]) => t.tag)).toEqual(
      plugin === jezzballPlugin ? [jezzballTemplate.tag] : [],
    );
  });

  it('should keep formly expressions serializable for built-in mods', () => {
    expect(userTemplate.config?.form?.find(f => f.key === 'subscriptions')?.expressions?.hide).toBe('!formState.admin.home');
    expect(blogTemplate.config?.form?.find(f => f.key === 'tags')?.expressions?.hide).toBe('!field.parent.model.filterTags');
    expect(llmPlugin.config?.advancedForm?.find(f => f.key === 'bundle')?.expressions?.hide).toBe('!model.json');
    expect(scrapePlugin.config?.form?.find(f => f.key === 'textSelectors')?.expressions?.hide).toBe('!field.parent.model.text');
  });
});
