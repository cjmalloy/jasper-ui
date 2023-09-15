import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { AdminService } from "../../service/admin.service";
import { ExtService } from "../../service/api/ext.service";
import { getPath, getQuery } from '../../util/hosts';
import { ConfigService } from '../../service/config.service';

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
    private exts: ExtService,
  ) { }

  ngOnInit() {
    this.nav = this.getNav();
    if (this.nav[0] === '/tag') {
      this.exts.getCachedExt(this.nav[1] as string)
      .subscribe(ext => {
        const tmpl = this.admin.getTemplate(ext.tag);
        const plugin = this.admin.getPlugin(ext.tag);
        if (ext.modifiedString) {
          this.text = ext.name || this.text;
        } else {
          this.text = tmpl?.name || plugin?.name || this.text;
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
}
