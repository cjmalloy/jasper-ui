import { uniq } from 'lodash-es';
import type { Plugin } from '../model/plugin';
import type { RootConfig } from '../mods/root';
import { localTag, topAnds } from './tag';

/**
 * Tags added to a Ref submitted from a tag page.
 */
export function getAddTags(tag: string | undefined, plugin: Plugin | undefined, rootConfig: RootConfig | undefined, home = false): string[] {
  if (!tag || home) return rootConfig?.addTags || plugin?.config?.reply || ['public'];
  if (plugin) {
    return uniq([
      ...rootConfig?.addTags || plugin.config?.reply || ['public'],
      ...plugin.config?.submit ? [plugin.tag] : [],
      ...plugin.config?.internal ? ['internal'] : []]);
  }
  return uniq([...rootConfig?.addTags || ['public'], ...topAnds(tag).map(localTag)]);
}
