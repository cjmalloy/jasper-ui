import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ext } from '../../../model/ext';
import { Action, Icon } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-subfolder',
  templateUrl: './subfolder.component.html',
  styleUrls: ['./subfolder.component.scss'],
  host: { 'class': 'subfolder' },
  imports: [RouterLink]
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
