import { Component, computed, inject, input } from '@angular/core';
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
  imports: [RouterLink]
})
export class SubfolderComponent {
  admin = inject(AdminService);
  store = inject(Store);
  private query = inject(QueryStore);

  readonly ext = input<Ext>();
  readonly name = input<string>();
  readonly dragging = input(false);

  submitted = false;
  icons: Icon[] = [];
  actions: Action[] = [];

  readonly thumbnail = computed(() => {
    // TODO: Thumbnail in config
    return '';
  });
}
