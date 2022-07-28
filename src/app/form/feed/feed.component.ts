import { AfterViewInit, Component, HostBinding, Input, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Feed } from '../../model/feed';
import { AdminService } from '../../service/admin.service';
import { ThemeService } from '../../service/theme.service';
import { TagsFormComponent } from '../tags/tags.component';

@Component({
  selector: 'app-feed-form',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss']
})
export class FeedFormComponent implements OnInit {
  @HostBinding('class') css = 'nested-form';

  @Input()
  group!: FormGroup;

  @ViewChild(TagsFormComponent)
  tags!: TagsFormComponent;

  constructor() { }

  ngOnInit(): void {
  }

  get url() {
    return this.group.get('url');
  }

  setFeed(feed: Feed) {
    const tags = this.group.get('tags') as FormArray;
    while (tags.length < (feed.tags?.length || 0)) this.tags.addTag()
    this.group.patchValue(feed);
  }

}

export function feedForm(fb: FormBuilder) {
  return fb.group({
    url: [''],
    name: [''],
    tags: fb.array([]),
    scrapeInterval: ['00:15:00'],
    scrapeDescription: [true],
    removeDescriptionIndent: [false],
  });
}
