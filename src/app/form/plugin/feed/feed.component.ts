import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import * as moment from 'moment';
import { AdminService } from '../../../service/admin.service';
import { intervalValidator } from '../../../util/form';
import { ORIGIN_REGEX } from '../../../util/format';
import { tagsForm, TagsFormComponent } from '../../tags/tags.component';

@Component({
  selector: 'app-form-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;
  @Input()
  fieldName = '+plugin/feed';

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

export function feedForm(fb: UntypedFormBuilder, admin: AdminService) {
  const defaultTags = ['public'];
  if (admin.status.plugins.thumbnail) defaultTags.push('plugin/thumbnail');
  return fb.group({
    origin: ['', [Validators.pattern(ORIGIN_REGEX)]],
    addTags: tagsForm(fb, defaultTags),
    scrapeInterval: ['PT15M', [intervalValidator()]],
    scrapeDescription: [true],
    removeDescriptionIndent: [false],
  });
}
