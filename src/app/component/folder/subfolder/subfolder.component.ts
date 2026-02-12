import { ChangeDetectionStrategy, Component, HostBinding, inject, input } from '@angular/core';
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
  admin = inject(AdminService);
  store = inject(Store);
  private query = inject(QueryStore);

  @HostBinding('attr.tabindex') tabIndex = 0;

  readonly ext = input<Ext>();
  readonly name = input<string>();
  readonly dragging = input(false);

  submitted = false;
  icons: Icon[] = [];
  actions: Action[] = [];

  get thumbnail() {
    // TODO: Thumbnail in config
    return '';
  }
}
