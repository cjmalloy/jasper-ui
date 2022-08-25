import { Injectable } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import * as _ from 'lodash-es';
import { LinksFormComponent } from '../form/links/links.component';
import { TagsFormComponent } from '../form/tags/tags.component';
import { RefSort } from '../model/ref';
import { getLinks, getNotifications, getTags } from '../util/editor';
import { getPath } from '../util/hosts';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  constructor(
    private config: ConfigService,
  ) { }

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
    if (ending.indexOf('/') < 0) return decodeURIComponent(ending);
    return decodeURIComponent(ending.substring(0, ending.indexOf('/')));
  }

  /**
   * Gets the query and sort for a query URL.
   * @param url
   */
  getQueryUrl(url: string): [string, RefSort] {
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
    if (!ending) return [url, ''];
    if (ending.indexOf('/') < 0) return [decodeURIComponent(ending), ''];
    const query = ending.substring(0, ending.indexOf('/'))
    ending = ending.substring(query.length)
    let sort = '';
    if (ending.length) {
      ending = ending.substring(1);
      if (ending.indexOf('/') < 0 && ending.indexOf('?') < 0) {
        sort = ending;
      }
      sort = ending.substring(0, Math.max(ending.indexOf('/'), ending.indexOf('?')))
    }
    return [decodeURIComponent(query), sort as RefSort];
  }

  /**
   * Extract sources, alternate urls and tags from the comment field and add
   * them to the Ref form.
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
    group.get('comment')?.setValue(comment);
  }

  private syncUrls(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    const existing = [
      ...getLinks(previousComment).map(url => this.getRefUrl(url)),
      ...group.value.sources,
      ...group.value.alternateUrls,
    ];
    const newAlts = _.uniq(_.difference(this.getAlts(group.value.comment), existing));
    for (const a of newAlts) {
      (group.get('alternateUrls') as UntypedFormArray).push(fb.control(a, LinksFormComponent.validators));
    }
    existing.push(...newAlts);
    const newSources = _.uniq(_.difference(this.getSources(group.value.comment), existing));
    for (const s of newSources) {
      (group.get('sources') as UntypedFormArray).push(fb.control(s, LinksFormComponent.validators));
    }
  }

  private syncTags(fb: UntypedFormBuilder, group: UntypedFormGroup, previousComment = '') {
    const existingTags = [
      ...getTags(previousComment),
      ...getNotifications(previousComment),
      ...group.value.tags,
    ];
    const newTags = _.uniq(_.difference([
      ...getTags(group.value.comment),
      ...getNotifications(group.value.comment)], existingTags));
    for (const t of newTags) {
      (group.get('tags') as UntypedFormArray).push(fb.control(t, TagsFormComponent.validators));
    }
  }

  getSources(markdown: string) {
    return _.difference(getLinks(markdown), this.getAlts(markdown)).map(url => this.getRefUrl(url));
  }

  getAlts(markdown: string) {
    return getLinks(markdown, /^\[?alt\d*]?$/).map(url => this.getRefUrl(url));
  }

}
