import { Component, HostBinding, OnInit } from "@angular/core";
import { AccountService } from "../../service/account.service";

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss']
})
export class SubscriptionBarComponent implements OnInit {
  @HostBinding('class') css = 'subscription-bar';

  subscriptions = [];

  constructor(
    private account: AccountService,
  ) {
    if (this.account.signedIn()) {
      this.account.getMyUserExt()
      .subscribe(ext => this.subscriptions = ext.config!.subscriptions);
    }
  }

  ngOnInit(): void {
  }

}
