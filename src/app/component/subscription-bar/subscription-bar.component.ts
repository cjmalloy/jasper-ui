import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { TitleDirective } from '../../directive/title.directive';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { EditorService, TagPreview } from '../../service/editor.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss'],
  host: { 'class': 'subscription-bar' },
  imports: [ RouterLink, RouterLinkActive, TitleDirective]
})
export class SubscriptionBarComponent implements OnDestroy {
  config = inject(ConfigService);
  store = inject(Store);
  themes = inject(ModService);
  admin = inject(AdminService);
  private editor = inject(EditorService);
  private exts = inject(ExtService);
  location = inject(Location);


  bookmarks: TagPreview[] = [];
  subs: TagPreview[] = [];

  private startIndex = this.currentIndex;

  constructor() {
    effect(() => this.editor.getTagsPreview(this.store.account.bookmarks, this.store.account.origin)
      .subscribe(xs => this.bookmarks = xs));
    effect(() => this.exts.getCachedExts(this.store.account.subs)
      .subscribe(xs => this.subs = xs));
  }

  ngOnDestroy() {
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
