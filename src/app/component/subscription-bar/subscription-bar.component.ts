import { Component, HostBinding, OnInit } from '@angular/core';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss'],
})
export class SubscriptionBarComponent implements OnInit {
  @HostBinding('class') css = 'subscription-bar';

  constructor(
    public store: Store,
    public themes: ThemeService,
  ) { }

  ngOnInit(): void {
  }
}
