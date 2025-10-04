import { Component, HostBinding, Input } from '@angular/core';
import { runInAction } from 'mobx';
import { Ext } from '../../../model/ext';
import { Action, Icon } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  standalone: false,
  selector: 'app-subfolder',
  templateUrl: './subfolder.component.html',
  styleUrls: ['./subfolder.component.scss'],
  host: {'class': 'subfolder'}
})
export class SubfolderComponent {
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  ext?: Ext;
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
    private query: QueryStore,
  ) { }

  get thumbnail() {
    // TODO: Thumbnail in config
    return '';
  }
}
