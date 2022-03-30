import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  userTag = '';

  constructor(
    private users: UserService,
  ) {
    users.whoAmI()
      .subscribe(tag => this.userTag = tag);
  }

  ngOnInit(): void {
  }

}
