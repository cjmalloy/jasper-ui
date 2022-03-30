import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss']
})
export class SubscriptionBarComponent implements OnInit {
  @HostBinding('class') css = 'subscription-bar';

  subscriptions?: string[];

  constructor(
    private users: UserService,
  ) {
    users.getMyUser()
    .subscribe(user => this.subscriptions = user.subscriptions)
  }

  ngOnInit(): void {
  }

}
