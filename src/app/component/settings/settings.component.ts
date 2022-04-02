import { Component, HostBinding, OnInit } from "@angular/core";
import { RefService } from "../../service/ref.service";
import { ConfigService } from "../../service/config.service";
import { mergeMap } from "rxjs/operators";
import * as moment from "moment";
import { AccountService } from "../../service/account.service";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  @HostBinding('class') css = 'settings';

  notifications = 0;

  constructor(
    public config: ConfigService,
    public account: AccountService,
    private refs: RefService,
  ) {
    this.account.getMyUserExt().pipe(
      mergeMap(ext => this.refs.count({
        query: "plugin/inbox/" + this.account.tag,
        modifiedAfter: ext.config?.inbox?.lastNotified || moment().subtract(1, 'year') }))
    ).subscribe(count => this.notifications = count);
  }

  ngOnInit(): void {
  }

}
