import { Component, HostBinding, OnInit } from "@angular/core";
import { UserService } from "../../service/user.service";
import { mergeMap } from "rxjs/operators";
import { TagService } from "../../service/tag.service";

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
    private tags: TagService,
  ) {
    this.users.whoAmI().pipe(
      mergeMap(user => this.tags.get(user)),
    ).subscribe(tag => this.subscriptions = tag.config?.subscriptions || []);
  }

  ngOnInit(): void {
  }

}
