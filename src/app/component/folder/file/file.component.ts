import { Component, HostBinding, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Ref } from '../../../model/ref';
import {
  Action,
  active,
  Icon,
  ResponseAction,
  sortOrder,
  TagAction,
  uniqueConfigs,
  Visibility,
  visible
} from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { AuthzService } from '../../../service/authz.service';
import { Store } from '../../../store/store';
import { templates } from '../../../util/format';
import { getScheme } from '../../../util/http';
import { memo, MemoCache } from '../../../util/memo';
import { hasTag, isOwnerTag } from '../../../util/tag';

@Component({
  selector: 'app-file',
  templateUrl: './file.component.html',
  styleUrls: ['./file.component.scss']
})
export class FileComponent implements OnChanges {
  @HostBinding('class') css = 'file ';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;
  @Input()
  dragging = false;

  expandPlugins: string[] = [];
  icons: Icon[] = [];
  actions: Action[] = [];
  publishedLabel = $localize`published`;
  editing = false;
  viewSource = false;
  writeAccess = false;
  taggingAccess = false;
  serverError: string[] = [];

  constructor(
    public admin: AdminService,
    private scraper: ScrapeService,
    public store: Store,
    private auth: AuthzService,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.ref) {
      MemoCache.clear(this);
      this.editing = false;
      this.viewSource = false;
      this.writeAccess = this.auth.writeAccess(this.ref);
      this.taggingAccess = this.auth.taggingAccess(this.ref);
      this.icons = uniqueConfigs(sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url))));
      this.actions = uniqueConfigs(sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins)));
      this.publishedLabel = this.admin.getPublished(this.ref.tags).join($localize`/`) || this.publishedLabel;
      this.expandPlugins = this.admin.getEmbeds(this.ref);
    }
  }

  @memo
  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '_').replace(/\./g, '-'))
      .join(' ');
  }

  @memo
  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  @memo
  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  @memo
  get thumbnail() {
    return this.admin.getPlugin('plugin/thumbnail') && hasTag('plugin/thumbnail', this.ref);
  }

  @memo
  get iconColor() {
    return this.ref?.plugins?.['plugin/thumbnail']?.color || '';
  }

  @memo
  get iconEmoji() {
    return this.ref?.plugins?.['plugin/thumbnail']?.emoji || '';
  }

  @memo
  get iconEmojiDefaults() {
    const iconLabel = this.icons.filter(i => i.label && (i.order || 0) >= 0 && this.showIcon(i))[0];
    const iconThumbnail = this.icons.filter(i => i.thumbnail && this.showIcon(i))[0];
    return iconLabel?.label || iconThumbnail?.thumbnail;
  }

  @memo
  get iconRadius() {
    return this.ref?.plugins?.['plugin/thumbnail']?.radius || 0;
  }

  @memo
  @HostBinding('class.sent')
  get isAuthor() {
    return isOwnerTag(this.store.account.tag, this.ref);
  }

  @memo
  get isRecipient() {
    return hasTag(this.store.account.mailbox, this.ref);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  visible(v: Visibility) {
    return visible(v, this.isAuthor, this.isRecipient);
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.ref, a);
  }
}
