import { Component, HostBinding, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Ref } from '../../../model/ref';
import { Action, Icon, sortOrder } from '../../../model/tag';
import { AdminService } from '../../../service/admin.service';
import { ScrapeService } from '../../../service/api/scrape.service';
import { AuthzService } from '../../../service/authz.service';
import { Store } from '../../../store/store';
import { TAGS_REGEX, templates } from '../../../util/format';
import { getScheme } from '../../../util/hosts';
import { hasTag } from '../../../util/tag';

@Component({
  selector: 'app-file',
  templateUrl: './file.component.html',
  styleUrls: ['./file.component.scss']
})
export class FileComponent implements OnChanges {
  @HostBinding('class') css = 'file';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAGS_REGEX.source;

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  expandInline = false;
  @Input()
  showToggle = false;

  expandPlugins: string[] = [];
  icons: Icon[] = [];
  actions: Action[] = [];
  publishedLabel = $localize`published`;
  tagging = false;
  editing = false;
  viewSource = false;
  deleting = false;
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
      this.deleting = false;
      this.editing = false;
      this.viewSource = false;
      this.tagging = false;
      this.writeAccess = this.auth.writeAccess(this.ref);
      this.taggingAccess = this.auth.taggingAccess(this.ref);
      this.icons = sortOrder(this.admin.getIcons(this.ref.tags, this.ref.plugins, getScheme(this.ref.url)));
      this.actions = sortOrder(this.admin.getActions(this.ref.tags, this.ref.plugins));
      this.publishedLabel = this.admin.getPublished(this.ref.tags).join($localize`/`) || this.publishedLabel;
      this.expandPlugins = this.admin.getEmbeds(this.ref);
    }
  }

  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '-'))
      .join(' ');
  }

  get nonLocalOrigin() {
    if (this.ref.origin === this.store.account.origin) return undefined;
    return this.ref.origin || '';
  }

  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  get thumbnail() {
    return this.admin.getPlugin('plugin/thumbnail') &&
      hasTag('plugin/thumbnail', this.ref);
  }
}
