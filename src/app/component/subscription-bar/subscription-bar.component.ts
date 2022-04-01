import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";
import { mergeMap } from "rxjs/operators";
import { ExtService } from "../../service/ext.service";

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
    private exts: ExtService,
  ) {
    this.users.whoAmI().pipe(
      mergeMap(user => this.exts.get(user)),
    ).subscribe(ext => this.subscriptions = ext.config?.subscriptions || []);
  }

  ngOnInit(): void {
  }

}
