import { Component, ElementRef, Input, OnInit } from '@angular/core';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ConfigService } from '../../service/config.service';
import { EditorService } from '../../service/editor.service';
import { VisibilityService } from '../../service/visibility.service';
import { getPath, parseParams } from '../../util/http';
import { hasPrefix } from '../../util/tag';

@Component({
  standalone: false,
  selector: 'app-nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss']
})
export class NavComponent implements OnInit {

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

  nav?: (string|number)[];

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private refs: RefService,
    private editor: EditorService,
    private vis: VisibilityService,
    private el: ElementRef,
  ) { }

  ngOnInit() {
    if (this.localUrl) {
      this.nav = this.getNav();
      if (this.nav[0] === '/tag' && !this.external && !this.hasText) {
        this.editor.getTagPreview(this.nav[1] as string)
          .subscribe(x => this.text = x?.name || this.text || x?.tag || '');
      }
    } else if (!this.external) {
      this.vis.notifyVisible(this.el, () => {
        this.refs.exists(this.url).subscribe(exists => {
          if (exists) {
            this.nav = ['/ref', this.url];
          }
        });
      });
    }
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
    if (!this.text || hasPrefix(this.text, 'user')) return false;
    if (this.url.startsWith('/tag/') || this.url.toLowerCase().startsWith('tag:/')) {
      if (this.text === '#' + this.url.substring(5)) return false;
    }
    return this.text != this.url;
  }

}
