import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import * as _ from 'lodash';
import { addAlt } from '../form/alts/alts.component';
import { RefFormComponent } from '../form/ref/ref.component';
import { addSource } from '../form/sources/sources.component';
import { addTag } from '../form/tags/tags.component';
import { extractPattern, getNotifications, getTags } from '../util/editor';
import { URI_REGEX } from '../util/format';
import { getPath } from '../util/hosts';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class EditorService {

  constructor(
    private config: ConfigService,
  ) { }

  getRefUrl(url: string): string {
    if (url.startsWith('unsafe:')) url = url.substring('unsafe:'.length);
    const refPrefix = this.config.base + 'ref/';
    if (url.startsWith(refPrefix)) {
      let ending = url.substring(refPrefix.length);
      ending = ending.substring(0, ending.indexOf('/'))
      return decodeURIComponent(ending);
    }
    const relRefPrefix = getPath(refPrefix)!;
    if (url.startsWith(relRefPrefix)) {
      let ending = url.substring(relRefPrefix.length);
      ending = ending.substring(0, ending.indexOf('/'))
      return decodeURIComponent(ending);
    }
    if (url.startsWith('/ref/')) {
      let ending = url.substring('/ref/'.length);
      ending = ending.substring(0, ending.indexOf('/'))
      return decodeURIComponent(ending);
    }
    return url;
  }

  syncEditor(fb: FormBuilder, group: FormGroup) {
    group.value.comment = group.value.comment.replace('](' + RefFormComponent.base, '](/');
    group.value.comment = group.value.comment.replace(']: ' + RefFormComponent.base, ']: /');
    const value = group.value.comment;
    const newSources = _.uniq(_.difference(this.getSources(value), group.value.sources));
    for (const s of newSources) {
      addSource(fb, group, s);
    }
    const newAlts = _.uniq(_.difference(this.getAlts(value), group.value.alternateUrls));
    for (const a of newAlts) {
      addAlt(fb, group, a);
    }
    const newTags = _.uniq(_.difference([
      ...getTags(value),
      ...getNotifications(value)], group.value.tags));
    for (const t of newTags) {
      addTag(fb, group, t);
    }
  }

  getSources(markdown: string) {
    return [
      ...extractPattern(markdown, /\[\[?\d+]?]:.*/g, /\[\[?\d+]?]:\s*(.*)/, URI_REGEX),
      ...extractPattern(markdown, /\[\[?\d+]?]:\s*\/ref\/.*/g, /\[\[?\d+]?]:\s*(\/ref\/.*)/).map(url => this.getRefUrl(url)),
      ...extractPattern(markdown, /\[\[?\d+]?]\(.*\)/g, /\[\[?\d+]?]\((.*)\)/, URI_REGEX),
      ...extractPattern(markdown, /\[\[?\d+]?]\(\/ref\/.*\)/g, /\[\[?\d+]?]\((\/ref\/.*)\)/).map(url => this.getRefUrl(url)),
    ];
  }

  getAlts(markdown: string) {
    return [
      ...extractPattern(markdown, /\[\[?alt\d*]?]:.*/g, /\[\[?alt\d*]?]:\s*(.*)/, URI_REGEX),
      ...extractPattern(markdown, /\[\[?alt\d+]?]:\s*\/ref\/.*/g, /\[\[?alt\d+]?]:\s*(\/ref\/.*)/).map(url => this.getRefUrl(url)),
      ...extractPattern(markdown, /\[\[?alt\d*]?]\(.*\)/g, /\[\[?alt\d*]?]\((.*)\)/, URI_REGEX),
      ...extractPattern(markdown, /\[\[?alt\d+]?]\(\/ref\/.*\)/g, /\[\[?alt\d+]?]\((\/ref\/.*)\)/).map(url => this.getRefUrl(url)),
    ];
  }

}
