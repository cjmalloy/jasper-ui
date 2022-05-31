import { Component, OnInit } from '@angular/core';
import { AccountService } from '../../service/account.service';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
})
export class SettingsPage implements OnInit {

  constructor(
    public account: AccountService,
  ) { }

  ngOnInit(): void {
  }

}
