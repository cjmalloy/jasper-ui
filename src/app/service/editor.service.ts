import { inject, Injectable } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import Europa from 'europa';
import { Plugin, PluginApi, PluginConverter } from 'europa-core';
import { difference, uniq } from 'lodash-es';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { TagsFormComponent } from '../form/tags/tags.component';
import { Ext } from '../model/ext';
import { Store } from '../store/store';
import { getMailboxes } from '../util/editor';
import { getPath } from '../util/http';
import { access, removePrefix, setPublic } from '../util/tag';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';
import { ConfigService } from './config.service';

export type TagPreview = { name?: string, tag: string } | Ext;

@Injectable({
  providedIn: 'root'
})
export class EditorService {
  private config = inject(ConfigService);
  private admin = inject(AdminService);
  private exts = inject(ExtService);
  private store = inject(Store);


  constructor() {
    const superscriptProvider = (api: PluginApi): Plugin => ({
      converters: {
        SUP: {
          startTag(conversion): boolean {
            conversion.output('^');
            conversion.atNoWhitespace = true;
            return true;
          },
        },
      },
    });
    const paragraphConverter: PluginConverter = {
      startTag(conversion, context): boolean {
        // @ts-ignore
        if (conversion.atParagraph || conversion.inline) return true;
        conversion.appendParagraph();
        return true;
      },

      endTag(conversion, context) {
        // @ts-ignore
        if (conversion.inline) return;
        conversion.appendParagraph();
      },
    };
    const paragraphProvider = (api: PluginApi): Plugin => ({
      converters: {
        ADDRESS: paragraphConverter,
        ARTICLE: paragraphConverter,
        ASIDE: paragraphConverter,
        DIV: paragraphConverter,
        FIELDSET: paragraphConverter,
        FOOTER: paragraphConverter,
        HEADER: paragraphConverter,
        MAIN: paragraphConverter,
        NAV: paragraphConverter,
        P: paragraphConverter,
        SECTION: paragraphConverter,
      },
    });
    const linkProvider = (api: PluginApi): Plugin => ({
      converters: {
        A: {
          startTag(conversion, context): boolean {
            const absolute = conversion.getOption('absolute');
            const inline = conversion.getOption('inline');
            const { element } = conversion;
            const href = element.attr('href');
            if (!href) {
              return true;
            }

            // Set inline flag
            // @ts-ignore
            conversion.inline = true;

            const title = element.attr('title');
            const url = absolute ? conversion.resolveUrl(href) : href;
            let value = title ? `${url} "${title}"` : url;

            if (inline) {
              value = `(${value})`;
            } else {
              const reference = conversion.addReference('link', value);
              value = `[${reference}]`;
            }

            context.set('value', value);
            conversion.output('[');
            conversion.atNoWhitespace = true;

            return true;
          },

          endTag(conversion, context) {
            if (context.has('value')) {
              conversion.output(`]${context.get<string>('value')}`);

              // Unset inline flag
              // @ts-ignore
              conversion.inline = false;
            }
          }
        }
      }
    });
    const audioProvider = (api: PluginApi): Plugin => ({
      converters: {
        AUDIO: {
          startTag(conversion): boolean {
            const { element } = conversion;
            const source = element.find('source')?.attr('src');
            if (!source) {
              return false; // No source found, skip
            }

            const absolute = conversion.getOption('absolute');
            const url = absolute ? conversion.resolveUrl(source) : source;
            const value = `(${url})`;

            conversion.output(`![]${value}`);

            return false;
          },
        },
      }
    });
    const videoProvider = (api: PluginApi): Plugin => ({
      converters: {
        VIDEO: {
          startTag(conversion): boolean {
            const { element } = conversion;
            const source = element.find('source')?.attr('src');
            if (!source) {
              return false; // No source found, skip
            }

            const absolute = conversion.getOption('absolute');
            const url = absolute ? conversion.resolveUrl(source) : source;
            const value = `(${url})`;

            conversion.output(`![]${value}`);

            return false;
          },
        },
      }
    });
    Europa.registerPlugin(superscriptProvider);
    Europa.registerPlugin(paragraphProvider);
    Europa.registerPlugin(linkProvider);
    Europa.registerPlugin(audioProvider);
    Europa.registerPlugin(videoProvider);
  }

  getUrlType(url: string) {
    if (url.startsWith(this.config.base)) {
      url = url.substring(this.config.base.length);
    }
    const basePath = getPath(this.config.base)!;
    if (url.startsWith(basePath)) {
      url = url.substring(basePath.length);
    }
    if (url.startsWith('/')) {
      url = url.substring(1);
    }
    return url.substring(0, url.indexOf('/'));
  }

  getRefUrl(url: string): string {
    if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
    const refPrefix = this.config.base + 'ref/';
    let ending = '';
    if (url.startsWith(refPrefix)) {
      ending = url.substring(refPrefix.length);
    } else {
      const relRefPrefix = getPath(refPrefix)!;
      if (url.startsWith(relRefPrefix)) {
        ending = url.substring(relRefPrefix.length);
      } else if (url.startsWith('/ref/')) {
        ending = url.substring('/ref/'.length);
      }
    }
    if (!ending) return url;
    if (ending.startsWith('/e/')){
      ending = ending.substring('/e/'.length);
      if (ending.indexOf('/') < 0) return decodeURIComponent(ending);
      return decodeURIComponent(ending.substring(0, ending.indexOf('/')));
    }
    return ending;
  }

  /**
   * Gets the query for a query URL.
   */
  getQuery(url: string): string {
    if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
    const tagPrefix = this.config.base + 'tag/';
    let ending = '';
    if (url.startsWith(tagPrefix)) {
      ending = url.substring(tagPrefix.length);
    } else {
      const relTagPrefix = getPath(tagPrefix)!;
      if (url.startsWith(relTagPrefix)) {
        ending = url.substring(relTagPrefix.length);
      } else if (url.startsWith('/tag/')) {
        ending = url.substring('/tag/'.length);
      }
    }
    if (!ending) return url;
    if (ending.indexOf('?') < 0) return ending;
    const query = ending.substring(0, ending.indexOf('?'))
    return decodeURIComponent(query);
  }

  /**
   * Add mailboxes for tagged users.
   */
  syncEditor(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    let comment = group.value.comment;
    // Store last synced comment in the form so that we can track what was already synced.
    // This will allow the user to remove a source, alt or tag without it being re-added
    // @ts-ignore
    previousComment ||= group.previousComment || '';
    // @ts-ignore
    group.previousComment = comment;
    this.syncMailboxes(fb, group, previousComment);
    group.get('comment')?.setValue(comment);
  }

  private syncMailboxes(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    const existingTags = [
      ...getMailboxes(previousComment, this.store.account.origin),
      ...(group.value.tags || []),
    ];
    const mailboxes = uniq(difference([
      ...getMailboxes(group.value.comment, this.store.account.origin)], existingTags));
    for (const t of mailboxes) {
      (group.get('tags') as UntypedFormArray).push(fb.control(t, TagsFormComponent.validators));
    }
  }

  getTagPreview(tag: string, defaultOrigin = '', returnDefault = true, loadTemplates = true, loadPlugins = true): Observable<{ name?: string, tag: string } | undefined> {
    return this.exts.getCachedExt(tag, defaultOrigin).pipe(
      switchMap(x => {
        const localExists = x.modified && x.origin === (defaultOrigin || this.store.account.origin);
        if (loadTemplates) {
          const templates = this.admin.getTemplates(x.tag).filter(t => t.tag);
          if (templates.length) {
            const longestMatch = templates[templates.length - 1];
            if (!localExists) {
              if (x.tag === '+user') return of({ ...x, name: (longestMatch.config?.view || longestMatch.name || longestMatch.tag) + ' / ' + $localize`⚓️ Root` });
              if (x.tag === '_user') return of({ ...x, name: (longestMatch.config?.view || longestMatch.name || longestMatch.tag) + ' / ' + $localize`🥷 Root` });
            }
            if (x.tag === longestMatch.tag) return of(longestMatch);
            const childTag = removePrefix(x.tag, longestMatch.tag.split('/').length);
            return of({ tag: x.tag, name: (longestMatch.config?.view || longestMatch.name || longestMatch.tag) + ' / ' + (x.name || childTag) });
          }
        }
        if (localExists) return of(x);
        const plugin = this.admin.getPlugin(x.tag);
        if (loadPlugins) {
          if (plugin) return of(plugin);
          const parentPlugins = this.admin.getParentPlugins(x.tag);
          if (parentPlugins.length) {
            const longestMatch = parentPlugins[parentPlugins.length - 1];
            if (x.tag === longestMatch.tag) return of(longestMatch);
            const childTag = removePrefix(x.tag, longestMatch.tag.split('/').length);
            if (longestMatch.tag === 'plugin/outbox') {
              const origin = childTag.substring(0, childTag.indexOf('/'));
              const remoteTag = childTag.substring(origin.length + 1);
              const originFormat = origin ? ' @' + origin : '';
              return this.exts.getCachedExt(remoteTag, origin).pipe(
                map(c => ({ tag: x.tag, name: (longestMatch.name || longestMatch.tag) + ' / ' + (c.name || c.tag) + originFormat })),
              );
            }
            let a = access(x.tag) || '+';
            return this.exts.getCachedExt(a + setPublic(childTag), defaultOrigin).pipe(
              map(c => ({ tag: x.tag, name: (longestMatch.config?.view || longestMatch.name || longestMatch.tag) + ' / ' + (c.name || setPublic(childTag)) })),
            );
          }
        }
        if (x.modified || returnDefault) return of(x);
        return of(undefined);
      })
    );
  }

  getTagsPreview(tags: string[], defaultOrigin = ''): Observable<TagPreview[]> {
    return forkJoin(tags.map( t => this.getTagPreview(t, defaultOrigin))).pipe(
      map(xs => xs.filter(x => !!x)),
    ) as Observable<{name?: string, tag: string}[]>;
  }
}
