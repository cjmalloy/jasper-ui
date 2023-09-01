import { Location } from '@angular/common';
import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';
import { map } from 'rxjs';
import { Ext } from '../../model/ext';
import { autorun, IReactionDisposer } from 'mobx';

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss'],
})
export class SubscriptionBarComponent implements OnInit, OnDestroy {
  @HostBinding('class') css = 'subscription-bar';
  private disposers: IReactionDisposer[] = [];

  bookmarkExts: Ext[] = [];
  subExts: Ext[] = [];

  private startIndex = this.currentIndex;

  constructor(
    public config: ConfigService,
    public store: Store,
    public themes: ThemeService,
    public admin: AdminService,
    private exts: ExtService,
    public location: Location,
  ) {
    this.disposers.push(autorun(() => this.exts.getCachedExts(this.store.account.bookmarks).pipe(
      map(xs => xs.map(x => this.getTemplate(x))),
    ).subscribe(xs => this.bookmarkExts = xs)));
    this.disposers.push(autorun(() => this.exts.getCachedExts(this.store.account.subs).pipe(
      map(xs => xs.map(x => this.getTemplate(x))),
    ).subscribe(xs => this.subExts = xs)));
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  get currentIndex() {
    if ('navigation' in window) {
      // @ts-ignore
      return navigation.currentEntry?.index || 0
    }
    return 0;
  }

  back() {
    if (this.currentIndex > this.startIndex) this.location.back();
  }

  private getTemplate(x: Ext): Ext {
    if (x.modifiedString) return x;
    const t = this.admin.getTemplate(x.tag);
    if (!t) return x;
    return { tag: t.tag, origin: t.origin, name: t.name, config: t.defaults };
  }
}
