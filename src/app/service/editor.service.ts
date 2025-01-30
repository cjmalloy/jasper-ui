import { Injectable } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import Europa from 'europa';
import { Plugin, PluginApi } from 'europa-core';
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

export type TagPreview = { name?: string, tag?: string } | Ext;

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private exts: ExtService,
    private store: Store,
  ) {
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
    Europa.registerPlugin(superscriptProvider);
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
        if (loadTemplates) {
          const templates = this.admin.getTemplates(x.tag).filter(t => t.tag);
          if (templates.length) {
            const longestMatch = templates[templates.length - 1];
            if (x.tag === longestMatch.tag) return of(longestMatch);
            const childTag = removePrefix(x.tag, longestMatch.tag.split('/').length);
            return of({ tag: x.tag, name: (longestMatch.config?.view || longestMatch.name || longestMatch.tag) + ' / ' + (x.name || childTag) });
          }
        }
        if (x.modified && x.origin === (defaultOrigin || this.store.account.origin)) return of(x);
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
            let a = access(x.tag);
            if (childTag === 'user' || childTag.startsWith('user/')) {
              a ||= '+';
            }
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
