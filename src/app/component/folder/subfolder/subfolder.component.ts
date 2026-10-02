import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ext } from '../../../model/ext';
import { Action, Icon } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-subfolder',
  templateUrl: './subfolder.component.html',
  styleUrls: ['./subfolder.component.scss'],
  host: {
    'class': 'subfolder',
    'tabindex': '0',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink]
})
export class SubfolderComponent {
  readonly ext = input<Ext>();
  readonly name = input<string>();
  readonly dragging = input(false);

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
