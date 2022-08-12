import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import * as moment from 'moment/moment';
import { intervalValidator } from '../../../util/form';
import { TagsFormComponent } from '../../tags/tags.component';

@Component({
  selector: 'app-origin-form',
  templateUrl: './origin.component.html',
  styleUrls: ['./origin.component.scss']
})
export class OriginFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = '+plugin/origin';

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  constructor() { }

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get(this.fieldName) as UntypedFormGroup;
  }

  get proxy() {
    return this.plugin.get('proxy') as UntypedFormControl;
  }

  get scrapeInterval() {
    return this.plugin.get('scrapeInterval') as UntypedFormControl;
  }

  convertInterval() {
    this.scrapeInterval.setValue(moment.duration(this.scrapeInterval.value));
  }

  setValue(value: any) {
    this.tags.setValue(value.addTags);
    this.plugin.patchValue(value);
  }
}

export function originForm(fb: UntypedFormBuilder) {
  return fb.group({
    query: [''],
    proxy: [''],
    addTags: fb.array([]),
    mapTags: fb.group({}),
    scrapeInterval: ['PT15M', [intervalValidator()]],
    lastScrape: [''],
  });
}
