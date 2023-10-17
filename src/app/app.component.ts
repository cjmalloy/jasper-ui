import { Component, HostBinding, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { ConfigService } from './service/config.service';
import { Store } from './store/store';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {

  @HostBinding('class.electron')
  electron = this.config.electron;

  debug = !isDevMode() && this.store.account.debug;
  website = 'https://github.com/cjmalloy/jasper-ui';

  constructor(
    public config: ConfigService,
    public store: Store,
    private router: Router,
  ) {
    if (!this.store.account.debug && this.config.version) this.website = 'https://github.com/cjmalloy/jasper-ui/releases/tag/' + this.config.version;
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
  }

  drop(event: DragEvent) {
    const items = event.dataTransfer?.items;
    if (!items) {
      this.store.submit.setFiles([]);
      return;
    }
    const files = [] as any;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind !== 'file') return;
      files.push(d.getAsFile());
    }
    event.preventDefault();
    this.store.submit.setFiles(files);
    if (!this.store.submit.upload) {
      this.router.navigate(['/submit/upload'], { queryParams: { tag: this.store.view.queryTags }});
    }
  }

}
