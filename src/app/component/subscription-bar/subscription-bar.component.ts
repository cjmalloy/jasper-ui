import { Location } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, effect, ElementRef, signal, untracked } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, take } from 'rxjs';
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
export class SubscriptionBarComponent implements AfterViewInit {
  readonly bookmarks = signal<TagPreview[]>([]);
  readonly subs = signal<TagPreview[]>([]);

  private startIndex = this.currentIndex;

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
    ).subscribe(() => this.startIndex = this.currentIndex);
    effect((onCleanup) => {
      const bookmarks = this.store.account.bookmarks();
      const origin = this.store.account.origin();
      untracked(() => {
        const sub = this.editor.getBookmarksPreview(bookmarks, origin).subscribe(xs => this.bookmarks.set(xs));
        onCleanup(() => sub.unsubscribe());
      });
    });
    effect((onCleanup) => {
      const subs = this.store.account.subs();
      untracked(() => {
        const sub = this.exts.getCachedExts(subs).subscribe(xs => this.subs.set(xs));
        onCleanup(() => sub.unsubscribe());
      });
    });
  }

  ngAfterViewInit() {
    this.help.pushStep(this.el?.nativeElement, $localize`The top bar holds bookmarks and subscriptions.`);
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
