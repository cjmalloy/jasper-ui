import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, afterNextRender } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, switchMap, take } from 'rxjs';
import { TitleDirective } from '../../directive/title.directive';
import { AdminService } from '../../service/admin.service';
import { ExtService } from '../../service/api/ext.service';
import { ConfigService } from '../../service/config.service';
import { EditorService, TagPreview } from '../../service/editor.service';
import { HelpService } from '../../service/help.service';
import { ModService } from '../../service/mod.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-subscription-bar',
  templateUrl: './subscription-bar.component.html',
  styleUrls: ['./subscription-bar.component.scss'],
  host: { 'class': 'subscription-bar' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, TitleDirective]
})
export class SubscriptionBarComponent {
  readonly bookmarks = toSignal(toObservable(computed(() => ({
    bookmarks: this.store.account.bookmarks(), origin: this.store.account.origin(),
  }))).pipe(switchMap(({ bookmarks, origin }) => this.editor.getBookmarksPreview(bookmarks, origin))),
  { initialValue: [] as TagPreview[] });
  readonly subs = toSignal(toObservable(this.store.account.subs).pipe(
    switchMap(subs => this.exts.getCachedExts(subs)),
  ), { initialValue: [] as TagPreview[] });

  private startIndex = this.currentIndex();

  constructor(
    public config: ConfigService,
    public store: Store,
    public themes: ModService,
    public admin: AdminService,
    private editor: EditorService,
    private exts: ExtService,
    public location: Location,
    private el: ElementRef,
    private help: HelpService,
    router: Router,
  ) {
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      take(1),
    ).subscribe(() => this.startIndex = this.currentIndex());
  }

  private readonly initializeView = afterNextRender(() => {
    this.help.pushStep(this.el?.nativeElement, $localize`The top bar holds bookmarks and subscriptions.`);
  });

  currentIndex() {
    if ('navigation' in window) {
      // @ts-ignore
      return navigation.currentEntry?.index || 0
    }
    return 0;
  }

  back() {
    if (this.currentIndex() > this.startIndex) this.location.back();
  }
}
