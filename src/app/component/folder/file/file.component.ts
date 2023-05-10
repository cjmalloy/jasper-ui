import { Component, HostBinding, Input, OnInit } from '@angular/core';
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
export class FileComponent implements OnInit {
  @HostBinding('class') css = 'file';
  @HostBinding('attr.tabindex') tabIndex = 0;
  tagRegex = TAGS_REGEX.source;

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

  private _ref!: Ref;

  constructor(
    public admin: AdminService,
    private scraper: ScrapeService,
    public store: Store,
    private auth: AuthzService,
  ) { }

  @HostBinding('class')
  get pluginClasses() {
    return this.css + templates(this.ref.tags, 'plugin')
      .map(t => t.replace(/\//g, '-'))
      .join(' ');
  }

  get ref(): Ref {
    return this._ref;
  }

  get origin() {
    return this.ref.origin || undefined;
  }

  @Input()
  set ref(value: Ref) {
    this._ref = value;
    this.deleting = false;
    this.editing = false;
    this.viewSource = false;
    this.tagging = false;
    this.writeAccess = this.auth.writeAccess(value);
    this.taggingAccess = this.auth.taggingAccess(value);
    this.icons = sortOrder(this.admin.getIcons(value.tags, value.plugins, getScheme(value.url)));
    this.actions = sortOrder(this.admin.getActions(value.tags, value.plugins));
    this.publishedLabel = this.admin.getPublished(value.tags).join($localize`/`) || this.publishedLabel;
    this.expandPlugins = this.admin.getEmbeds(value.tags);
  }

  ngOnInit(): void {
  }

  get local() {
    return this.ref.origin === this.store.account.origin;
  }

  get thumbnail() {
    return this.admin.status.plugins.thumbnail &&
      hasTag('plugin/thumbnail', this.ref);
  }

  cssUrl(url: string | null) {
    if (!url) return '';
    if (this.admin.status.plugins.thumbnail?.config?.cache) {
      url = this.scraper.getFetch(url);
    }
    return `url('${url}')`;
  }
}
