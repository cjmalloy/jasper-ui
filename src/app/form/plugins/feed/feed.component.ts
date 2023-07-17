import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import * as moment from 'moment';
import { AdminService } from '../../../service/admin.service';
import { intervalValidator } from '../../../util/form';
import { tagsForm, TagsFormComponent } from '../../tags/tags.component';

@Component({
  selector: 'app-form-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedFormComponent implements OnInit {

  @Input()
  plugins!: UntypedFormGroup;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  ngOnInit(): void {
  }

  get plugin() {
    return this.plugins.get('+plugin/feed') as UntypedFormGroup;
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
    this.tags.setValue(value['+plugin/feed'].addTags);
    this.plugins.patchValue(value);
  }
}

export function feedForm(fb: UntypedFormBuilder, admin: AdminService) {
  const result =  fb.group({
    addTags: tagsForm(fb, ['public']),
    scrapeInterval: ['PT15M', [intervalValidator()]],
    disableEtag: [false],
    scrapeWebpage: [false],
    scrapeDescription: [true],
    scrapeContents: [true],
    scrapeAuthors: [true],
    scrapeThumbnail: [true],
    scrapeAudio: [true],
    scrapeVideo: [true],
    scrapeEmbed: [true],
  });
  result.patchValue(admin.status.plugins.feed?.defaults);
  return result;
}
