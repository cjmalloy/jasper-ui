import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Page } from '../../model/page';
import { IsTag } from '../../model/tag';

@Component({
  selector: 'app-tag-list',
  templateUrl: './tag-list.component.html',
  styleUrls: ['./tag-list.component.scss']
})
export class TagListComponent implements OnInit {
  @HostBinding('class') css = 'tag-list';

  @Input()
  page?: Page<IsTag> | null;

  constructor() { }

  ngOnInit(): void {
  }

}
