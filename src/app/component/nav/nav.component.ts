import { Component, Input, OnInit } from '@angular/core';
import { map } from 'rxjs';
import { AdminService } from "../../service/admin.service";
import { ExtService } from "../../service/api/ext.service";
import { RefService } from '../../service/api/ref.service';
import { ConfigService } from '../../service/config.service';
import { getPath, getQuery } from '../../util/hosts';

@Component({
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
  css = 'css';

  nav?: (string|number)[];

  constructor(
    private config: ConfigService,
    private admin: AdminService,
    private refs: RefService,
    private exts: ExtService,
  ) { }

  ngOnInit() {
    if (this.localUrl) {
      this.nav = this.getNav();
      if (this.nav[0] === '/tag') {
        this.exts.getCachedExt(this.nav[1] as string)
          .pipe(this.admin.extFallback)
          .subscribe(x => this.text = x.name || this.text);
      }
    } else {
      this.refs.page({ url: this.url, size: 1 }).pipe(
        map(page => page.empty ? null : page.content[0])
      ).subscribe(ref => {
        if (ref) {
          this.nav = ['/ref', this.url];
        }
      });
    }
  }

  getNav() {
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
    return new URLSearchParams(getQuery(this.url));
  }

  get localUrl() {
    if (this.url.startsWith(this.config.base)) return true
    if (this.url.startsWith(getPath(this.config.base)!)) return true;
    if (this.url.startsWith('/')) return true;
    return false;
  }

}
