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

  constructor(
    public admin: AdminService,
    public config: ConfigService,
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

}
