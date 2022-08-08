import { Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { Feed } from '../../model/feed';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-feed-form',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: UntypedFormGroup;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  constructor() { }

  ngOnInit(): void {
  }

  get url() {
    return this.group.get('url');
  }

  setFeed(feed: Feed) {
    const tags = this.group.get('tags') as UntypedFormArray;
    while (tags.length < (feed.tags?.length || 0)) this.tags.addTag()
    this.group.patchValue(feed);
  }

}

export function feedForm(fb: UntypedFormBuilder) {
  return fb.group({
    url: [''],
    name: [''],
    tags: fb.array([]),
    scrapeInterval: ['00:15:00'],
    scrapeDescription: [true],
    removeDescriptionIndent: [false],
  });
}
