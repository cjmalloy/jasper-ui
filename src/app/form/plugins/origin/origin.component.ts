import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import * as moment from 'moment';
import { AdminService } from '../../../service/admin.service';
import { intervalValidator } from '../../../util/form';
import { ORIGIN_REGEX, ORIGIN_WILDCARD_REGEX } from '../../../util/format';
import { TagsFormComponent } from '../../tags/tags.component';

@Component({
  selector: 'app-form-origin',
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

  get origin() {
    return this.plugin.get('origin') as UntypedFormControl;
  }

  get remote() {
    return this.plugin.get('remote') as UntypedFormControl;
  }

  get proxy() {
    return this.plugin.get('proxy') as UntypedFormControl;
  }

  get query() {
    return this.plugin.get('query') as UntypedFormControl;
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

export function originForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result = fb.group({
    origin: ['', [Validators.required, Validators.pattern(ORIGIN_REGEX)]],
    remote: ['', [Validators.pattern(ORIGIN_WILDCARD_REGEX)]],
    overwriteOrigins: [false],
    generateMetadata: [true],
    query: [''],
    proxy: [''],
    removeTags: fb.array([]),
    mapTags: fb.group({}),
    addTags: fb.array([]),
    mapOrigins: fb.group({}),
    scrapeInterval: ['PT15M', [intervalValidator()]],
    lastScrape: [''],
  });
  result.patchValue(admin.status.plugins.origin?.defaults);
  return result;
}
