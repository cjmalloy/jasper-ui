import { Component, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { VisibilityService } from '../../service/visibility.service';
import { Store } from '../../store/store';
import { getPath, parseParams } from '../../util/http';
import { hasPrefix } from '../../util/tag';

@Component({
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  imports: [RouterLink]
})
export class NavComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input()
  origin: string = '';
  @Input()
  url: string = '';
  @Input()
  title = '';
  @Input()
  text = '';
  @Input()
  css = '';
  @Input()
  external = false;
  @Input()
  shortUser = false;

  nav?: (string|number)[];

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private store: Store,
    private refs: RefService,
    private ts: TaggingService,
    private editor: EditorService,
    private vis: VisibilityService,
    private el: ElementRef,
  ) { }

  ngOnInit() {
    if (this.localUrl) {
      this.nav = this.getNav();
      if (this.nav[0] === '/tag' && !this.external && !this.hasText) {
        const tag = this.nav[1] as string;
        this.text = this.text || (tag && !tag.startsWith('@') ? '#' + tag : tag) || '';
        this.title ||= tag ? '#' + tag : '';
        this.editor.getTagPreview(tag, this.origin, true, !this.shortUser || !hasPrefix(tag, 'user'))
          .pipe(takeUntil(this.destroy$))
          .subscribe(x => {
            this.text = x?.name || this.text;
            if (this.store.view.browser) {
              this.nav = ['/browse/', 'tag:/' + this.nav![1]];
            }
          });
      }
    } else if (!this.external) {
      this.vis.notifyVisible(this.el, () => {
        this.refs.exists(this.url).pipe(takeUntil(this.destroy$)).subscribe(exists => {
          if (exists) {
            this.nav = [this.store.view.refPath, this.url];
          }
        });
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getNav() {
    if (this.url.toLowerCase().startsWith('tag:/')) {
      return ['/tag', getPath(this.url.substring('tag:'.length))!.substring(1)];
    }
    let path = getPath(this.url) || '';
    const basePath = getPath(this.config.base)!;
    if (path.startsWith(basePath)) {
      path = path.substring(basePath.length);
    }
    if (path.startsWith('/')) {
      path = path.substring(1);
    }
    const parts = path.split('/');
    if (path.startsWith('ref/e/')) {
      return ['/ref', + decodeURIComponent(parts[2])];
    }
    const route = parts[0];
    parts.splice(0, 1);
    return ['/' + route, parts.join('/')];
  }

  get query() {
    return parseParams(this.url);
  }

  get localUrl() {
    if (this.url.toLowerCase().startsWith('tag:/'))return true
    if (this.url.startsWith(this.config.base)) return true
    if (this.url.startsWith(getPath(this.config.base)!)) return true;
    if (this.url.startsWith('/')) return true;
    return false;
  }

  get hasText() {
    if (!this.text || hasPrefix(this.text, 'user') || hasPrefix(this.text, 'plugin')) return false;
    if (this.url.startsWith('/tag/') || this.url.toLowerCase().startsWith('tag:/')) {
      if (this.text === '#' + this.url.substring(5)) return false;
    }
    return this.text != this.url;
  }

  markRead() {
    if (!this.admin.getPlugin('plugin/user/read')) return;
    this.ts.createResponse('plugin/user/read', this.url).subscribe();
  }

}
