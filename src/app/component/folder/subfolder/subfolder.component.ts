import { Component, HostBinding, Input } from '@angular/core';
import { Action, Icon } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { Store } from '../../../store/store';

@Component({
  standalone: false,
  selector: 'app-subfolder',
  templateUrl: './subfolder.component.html',
  styleUrls: ['./subfolder.component.scss']
})
export class SubfolderComponent {
  @HostBinding('class') css = 'subfolder';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  tag?: string;
  @Input()
  name?: string;
  @Input()
  dragging = false;

  submitted = false;
  icons: Icon[] = [];
  actions: Action[] = [];

  constructor(
    public admin: AdminService,
    public store: Store,
  ) { }

  get thumbnail() {
    // TODO: Thumbnail in config
    return '';
  }

}
