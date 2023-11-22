import { Injectable } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { difference, uniq } from 'lodash-es';
import { LinksFormComponent } from '../form/links/links.component';
import { TagsFormComponent } from '../form/tags/tags.component';
import { Store } from '../store/store';
import { getLinks, getMailboxes, getTags } from '../util/editor';
import { getPath } from '../util/hosts';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  constructor(
    private config: ConfigService,
    private store: Store,
  ) { }

  localUrl(url: string) {
    if (url.startsWith(this.config.base)) return true
    if (url.startsWith(getPath(this.config.base)!)) return true;
    if (url.startsWith('/')) return true;
    return false;
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
   * Extract sources, alternate urls and tags from the comment field and add
   * them to the Ref form.
   * Fix the numbering of sources and alts linked with the form [1](url)
   * or [alt1](url).
   */
  syncEditor(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    let comment = group.value.comment;
    // Store last synced comment in the form so that we can track what was already synced.
    // This will allow the user to remove a source, alt or tag without it being re-added
    // @ts-ignore
    previousComment ||= group.previousComment || '';
    // @ts-ignore
    group.previousComment = comment;
    // Make URLs to this site relative so that they work on multiple sites
    comment = comment.replace('](' + this.config.base, '](/');
    comment = comment.replace(']: ' + this.config.base, ']: /');
    this.syncUrls(fb, group, previousComment);
    this.syncTags(fb, group, previousComment);
    comment = this.reNumberSources(comment, group.value.sources);
    comment = this.reNumberAlts(comment, group.value.alternateUrls);
    group.get('comment')?.setValue(comment);
  }

  private syncUrls(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    const existing = [
      ...getLinks(previousComment).map(url => this.getRefUrl(url)),
      ...(group.value.sources || []),
      ...(group.value.alternateUrls || []),
    ];
    const newAlts = uniq(difference(this.getAlts(group.value.comment), existing));
    for (const a of newAlts) {
      (group.get('alternateUrls') as UntypedFormArray).push(fb.control(a, LinksFormComponent.validators));
    }
    existing.push(...newAlts);
    const newSources = uniq(difference(this.getSources(group.value.comment), existing));
    for (const s of newSources) {
      (group.get('sources') as UntypedFormArray).push(fb.control(s, LinksFormComponent.validators));
    }
  }

  private syncTags(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    const existingTags = [
      ...getTags(previousComment),
      ...getMailboxes(previousComment, this.store.account.origin),
      ...(group.value.tags || []),
    ];
    const newTags = uniq(difference([
      ...getTags(group.value.comment),
      ...getMailboxes(group.value.comment, this.store.account.origin)], existingTags));
    for (const t of newTags) {
      (group.get('tags') as UntypedFormArray).push(fb.control(t, TagsFormComponent.validators));
    }
  }

  private reNumberSources(markdown: string, sources: string[]) {
    if (!sources) return markdown;
    let i = 0;
    for (const s of sources) {
      i++;
      markdown = markdown.replace(new RegExp(`\\[\\d+]\\(${s}\\)`, 'g'), `[${i}](${s})`);
      markdown = markdown.replace(new RegExp(`\\[\\[\\d+]]\\(${s}\\)`, 'g'), `[[${i}]](${s})`);
      markdown = markdown.replace(new RegExp(`(^|[^[])\\[${i}]([^[(]|$)`, 'g'), `$1[${i}](${s})$2`);
      markdown = markdown.replace(new RegExp(`\\[\\[${i}]]([^(]|$)`, 'g'), `[[${i}]](${s})$1`);
    }
    return markdown;
  }

  private reNumberAlts(markdown: string, alts: string[]) {
    if (!alts) return markdown;
    let i = 0;
    for (const s of alts) {
      i++;
      markdown = markdown.replace(new RegExp(`\\[alt\\d+]\\(${s}\\)`, 'g'), `[alt${i}](${s})`);
      markdown = markdown.replace(new RegExp(`\\[\\[alt\\d+]]\\(${s}\\)`, 'g'), `[[alt${i}]](${s})`);
      markdown = markdown.replace(new RegExp(`(^|[^[])\\[alt${i}]([^[(]|$)`, 'g'), `$1[alt${i}](${s})$2`);
      markdown = markdown.replace(new RegExp(`\\[\\[alt${i}]]([^(]|$)`, 'g'), `[[alt${i}]](${s})$1`);
    }
    return markdown;
  }

  getSources(markdown: string) {
    return difference(getLinks(markdown), this.getAlts(markdown)).map(url => this.getRefUrl(url));
  }

  getAlts(markdown: string) {
    return getLinks(markdown, /^\[?alt\d*]?$/).map(url => this.getRefUrl(url));
  }

}
