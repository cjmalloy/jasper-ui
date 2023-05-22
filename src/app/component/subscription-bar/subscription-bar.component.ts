import { Location } from '@angular/common';
import { Component, HostBinding, OnInit } from '@angular/core';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss'],
})
export class SubscriptionBarComponent implements OnInit {
  @HostBinding('class') css = 'subscription-bar';

  // @ts-ignore
  private startIndex = navigation.currentEntry?.index || 0;

  constructor(
    public config: ConfigService,
    public store: Store,
    public themes: ThemeService,
    public admin: AdminService,
    private exts: ExtService,
    public location: Location,
  ) { }

  ngOnInit(): void {
  }

  get bookmarkExts$() {
    return this.exts.getCachedExts(this.store.account.bookmarks);
  }

  get subExts$() {
    return this.exts.getCachedExts(this.store.account.subs);
  }

  back() {
    // @ts-ignore
    const index = navigation.currentEntry?.index || 0;
    console.log(index);
    if (index > this.startIndex) this.location.back();
  }
}
