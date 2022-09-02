import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../service/admin.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsPage implements OnInit {

  searchablePages = [
    'ext',
    'user',
    'feed',
    'origin',
    'plugin',
    'template',
  ];

  filterablePages = [
    'feed',
    'origin',
  ];

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public store: Store,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
  }

  get currentPage() {
    return this.route.snapshot.firstChild?.url?.[0].path!;
  }

  get searchable() {
    return this.searchablePages.includes(this.currentPage);
  }

  get filterable() {
    return this.filterablePages.includes(this.currentPage);
  }

}
