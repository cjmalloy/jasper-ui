import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Feed } from '../../model/feed';
import { Page } from '../../model/page';

@Component({
  selector: 'app-feed-list',
  templateUrl: './feed-list.component.html',
  styleUrls: ['./feed-list.component.scss'],
})
export class FeedListComponent implements OnInit {
  @HostBinding('class') css = 'feed-list';

  @Input()
  page?: Page<Feed> | null;

  constructor() { }

  ngOnInit(): void {
  }

}
