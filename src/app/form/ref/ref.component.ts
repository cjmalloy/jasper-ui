import { Component, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Ref } from '../../model/ref';
import { getAlts, getNotifications, getSources, getTags } from '../../util/editor';
import { addAlt } from '../alts/alts.component';
import { pluginsForm } from '../plugins/plugins.component';
import { addSource } from '../sources/sources.component';
import { addTag } from '../tags/tags.component';

@Component({
  selector: 'app-ref-form',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefFormComponent implements OnInit {

  @Input()
  group!: FormGroup;

  constructor(
    private fb: FormBuilder,
  ) {}

  ngOnInit(): void {
  }

  get title() {
    return this.group.get('title') as FormControl;
  }

  get published() {
    return this.group.get('published') as FormControl;
  }

  syncEditor() {
    syncEditor(this.fb, this.group);
  }

}

export function refForm(fb: FormBuilder) {
  return fb.group({
    url: [''],
    published: [moment().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS), [Validators.required]],
    title: ['', [Validators.required]],
    comment: [''],
    sources: fb.array([]),
    alternateUrls: fb.array([]),
    tags: fb.array([]),
    plugins: fb.group({})
  });
}

export function setRef(fb: FormBuilder, group: FormGroup, ref: Ref) {
  const sourcesForm = group.get('sources') as FormArray;
  const altsForm = group.get('alternateUrls') as FormArray;
  const tagsForm = group.get('tags') as FormArray;
  while (sourcesForm.length < (ref?.sources?.length || 0)) addSource(fb, group);
  while (altsForm.length < (ref?.alternateUrls?.length || 0)) addAlt(fb, group);
  while (tagsForm.length < (ref?.tags?.length || 0)) addTag(fb, group);
  group.setControl('plugins', pluginsForm(fb, ref.tags || []));
  group.patchValue({
    ...ref,
    published: ref.published?.format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS),
  });
}

export function syncEditor(fb: FormBuilder, group: FormGroup) {
  const value = group.value.comment;
  const newSources = _.uniq(_.difference(getSources(value), group.value.sources));
  for (const s of newSources) {
    addSource(fb, group, s);
  }
  const newAlts = _.uniq(_.difference(getAlts(value), group.value.alternateUrls));
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
