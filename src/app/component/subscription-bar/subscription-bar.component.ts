import { Component, HostBinding, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AccountService } from '../../service/account.service';

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss'],
})
export class SubscriptionBarComponent implements OnInit {
  @HostBinding('class') css = 'subscription-bar';
  subs$: Observable<string[]>;

  constructor(
    public account: AccountService,
  ) {
    this.subs$ = account.subscriptions$;
  }

  ngOnInit(): void {
  }

}
