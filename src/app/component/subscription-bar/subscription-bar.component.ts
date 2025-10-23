import { Location } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { autorun, IReactionDisposer } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { TitleDirective } from '../../directive/title.directive';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { EditorService, TagPreview } from '../../service/editor.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';

@Component({
    selector: 'app-subscription-bar',
    templateUrl: './subscription-bar.component.html',
    styleUrls: ['./subscription-bar.component.scss'],
    host: { 'class': 'subscription-bar' },
    imports: [MobxAngularModule, RouterLink, RouterLinkActive, TitleDirective]
})
export class SubscriptionBarComponent implements OnDestroy {
  private disposers: IReactionDisposer[] = [];

  bookmarks: TagPreview[] = [];
  subs: TagPreview[] = [];

  private startIndex = this.currentIndex;

  constructor(
    public config: ConfigService,
    public store: Store,
    public themes: ModService,
    public admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
    public location: Location,
  ) {
    this.disposers.push(autorun(() => this.editor.getTagsPreview(this.store.account.bookmarks, this.store.account.origin)
      .subscribe(xs => this.bookmarks = xs)));
    this.disposers.push(autorun(() => this.exts.getCachedExts(this.store.account.subs)
      .subscribe(xs => this.subs = xs)));
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
}
