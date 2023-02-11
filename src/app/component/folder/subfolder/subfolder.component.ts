import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Action, Icon } from '../../../model/plugin';
import { AdminService } from '../../../service/admin.service';
import { Store } from '../../../store/store';
import { TAGS_REGEX } from '../../../util/format';

@Component({
  selector: 'app-subfolder',
  templateUrl: './subfolder.component.html',
  styleUrls: ['./subfolder.component.scss']
})
export class SubfolderComponent implements OnInit {
  @HostBinding('class') css = 'subfolder';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAGS_REGEX.source;

  @Input()
  tag?: string;
  @Input()
  name?: string;

  submitted = false;
  icons: Icon[] = [];
  actions: Action[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

  get thumbnail() {
    // TODO: Thumbnail in config
    return '';
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }

}
