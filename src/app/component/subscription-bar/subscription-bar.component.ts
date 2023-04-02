import { Component, HostBinding, OnInit } from '@angular/core';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';
import { Location } from "@angular/common";

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
    public location: Location,
  ) { }

  ngOnInit(): void {
  }

}
