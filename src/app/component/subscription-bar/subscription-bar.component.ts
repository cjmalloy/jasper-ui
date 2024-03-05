import { Location } from '@angular/common';
import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer } from 'mobx';
import { map } from 'rxjs';
import { Ext } from '../../model/ext';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';

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
    public themes: ModService,
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
    if (t) {
      return { tag: t.tag, origin: x.origin, name: t.name, config: t.defaults };
    }
    const p = this.admin.getPlugin(x.tag);
    if (p) {
      return { tag: p.tag, origin: x.origin, name: p.name, config: p.defaults };
    }
    return x;
  }
}
