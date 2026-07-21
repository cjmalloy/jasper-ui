import { describe, expect, it } from 'vitest';
import { asyncScrapeTargetPlugins, scrapeMod } from './scrape';

describe('scrapeMod', () => {
  it('installs every async scrape target plugin', () => {
    expect(asyncScrapeTargetPlugins.map(plugin => plugin.tag)).toEqual([
      '_plugin/delta/scrape/ref',
      '_plugin/delta/scrape/title',
      '_plugin/delta/scrape/comment',
      '_plugin/delta/scrape/sources',
      '_plugin/delta/scrape/alts',
      '_plugin/delta/scrape/plugins',
      '_plugin/delta/scrape/tags',
      '_plugin/delta/scrape/published',
    ]);
    expect(scrapeMod.plugin).toEqual(expect.arrayContaining(asyncScrapeTargetPlugins));
    expect(asyncScrapeTargetPlugins.every(plugin => plugin.config?.default)).toBe(true);
  });
});
