import { Component, HostBinding, HostListener, Input, OnInit } from '@angular/core';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { AuthzService } from '../../../service/authz.service';
import { hasComment, trimCommentForTitle } from '../../../util/format';
import { hasTag } from '../../../util/tag';
import { Store } from "../../../store/store";
import { ConfigService } from "../../../service/config.service";
import { defer } from "lodash-es";

@Component({
  selector: 'app-kanban-card',
  templateUrl: './kanban-card.component.html',
  styleUrls: ['./kanban-card.component.scss']
})
export class KanbanCardComponent implements OnInit {
  @HostBinding('class') css = 'kanban-card';

  @HostBinding('class.unlocked')
  unlocked = false;

  title = '';
  repostRef?: Ref;

  private _ref!: Ref;

  constructor(
    private admin: AdminService,
    private config: ConfigService,
    private auth: AuthzService,
    private refs: RefService,
    private store: Store,
    private scraper: ScrapeService,
  ) { }

  get ref() {
    return this._ref;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.title = this.getTitle();
    if (this.repost && value && (!this.repostRef || this.repostRef.url != value.url && this.repostRef.origin === value.origin)) {
      this.refs.get(this.url, value.origin)
        .subscribe(ref => {
          this.repostRef = ref;
          if (this.bareRepost) {
            this.title = this.getTitle();
          }
        });
    }
  }

  ngOnInit(): void {
  }

  @HostBinding('class.no-write')
  get noWrite() {
    return !this.auth.writeAccess(this.ref);
  }

  get repost() {
    return this.ref?.sources?.length && hasTag('plugin/repost', this.ref);
  }

  get bareRepost() {
    return this.repost && !this.ref.title && !this.ref.comment;
  }

  get url() {
    return this.repost ? this.ref.sources![0] : this.ref.url;
  }

  get currentText() {
    const value = this.ref?.comment || this.repostRef?.comment || '';
    if (this.ref?.title || hasComment(value)) return value;
    return '';
  }

  get thumbnail() {
    return this.admin.status.plugins.thumbnail &&
      hasTag('plugin/thumbnail', this.ref) || hasTag('plugin/thumbnail', this.repostRef);
  }

  get thumbnailUrl() {
    return this.thumbnail && !this.thumbnailColor;
  }

  get thumbnailColor() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.color || this.repostRef?.plugins?.['plugin/thumbnail']?.color);
  }

  get thumbnailEmoji() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.emoji || this.repostRef?.plugins?.['plugin/thumbnail']?.emoji) || '';
  }

  get thumbnailRadius() {
    return this.thumbnail &&
      (this.ref?.plugins?.['plugin/thumbnail']?.radius || this.repostRef?.plugins?.['plugin/thumbnail']?.radius) || 0;
  }

  @HostListener('touchend', ['$event'])
  touchend(e: TouchEvent) {
    this.unlocked = false;
  }

  @HostListener('press', ['$event'])
  unlock(event: any) {
    if (!this.config.mobile) return;
    this.unlocked = true;
    defer(() => window.navigator.vibrate([200, 200, 200]));
  }

  getTitle() {
    if (this.bareRepost) return this.repostRef?.title || $localize`Repost`;
    const title = (this.ref.title || '').trim();
    const comment = (this.ref.comment || '').trim();
    if (title) return title;
    if (!comment) return this.url;
    return trimCommentForTitle(comment);
  }

  cssUrl(url: string | null) {
    if (!url) return '';
    if (this.admin.status.plugins.thumbnail?.config?.cache) {
      url = this.scraper.getFetch(url);
    }
    return `url('${url}')`;
  }

}
