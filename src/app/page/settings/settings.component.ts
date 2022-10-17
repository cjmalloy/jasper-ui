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

  tagPages = [
    'ext',
    'user',
    'plugin',
    'template',
  ];

  refPages = [
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
    return this.route.snapshot.firstChild?.url?.[0].path as 'ext' | 'user' | 'plugin' | 'template';
  }

  get type() {
    if (this.refPages.includes(this.currentPage)) return 'ref';
    if (this.tagPages.includes(this.currentPage)) return this.currentPage;
    return undefined;
  }

}
