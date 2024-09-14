import { AfterViewInit, Component, HostBinding, HostListener, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { autorun, runInAction } from 'mobx';
import { archivePlugin, archiveUrl } from './mods/archive';
import { pdfPlugin, pdfUrl } from './mods/pdf';
import { AdminService } from './service/admin.service';
import { OriginService } from './service/api/origin.service';
import { ProxyService } from './service/api/proxy.service';
import { ConfigService } from './service/config.service';
import { Store } from './store/store';
import { memo } from './util/memo';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {

  @HostBinding('class.electron')
  electron = this.config.electron;

  debug = !isDevMode() && this.store.account.debug;
  website = 'https://github.com/cjmalloy/jasper-ui';

  pdfPlugin = this.admin.getPlugin('plugin/pdf') as typeof pdfPlugin || undefined;
  archivePlugin = this.admin.getPlugin('plugin/archive') as typeof archivePlugin || undefined;

  constructor(
    public config: ConfigService,
    public store: Store,
    private admin: AdminService,
    private proxy: ProxyService,
    private origins: OriginService,
    private router: Router,
  ) {
    if (!this.store.account.debug && this.config.version) this.website = 'https://github.com/cjmalloy/jasper-ui/releases/tag/' + this.config.version;
  }

  ngAfterViewInit() {
    if (this.pdfPlugin) {
      autorun(() => {
        if (this.store.eventBus.event === 'pdf') {
          let url = pdfUrl(this.pdfPlugin, this.store.eventBus.ref, this.store.eventBus.repost);
          if (!url) return;
          if (this.pdfPlugin!.config?.proxy) url = this.proxy.getFetch(url);
          open(url, '_blank');
        }
      });
    }
    if (this.archivePlugin) {
      autorun(() => {
        if (this.store.eventBus.event === 'archive') {
          let url = archiveUrl(this.archivePlugin, this.store.eventBus.ref, this.store.eventBus.repost);
          if (!url) return;
          open(url, '_blank');
        }
      });
    }

    visualViewport?.addEventListener('resize', event => {
      const vv = event?.target as VisualViewport;
      runInAction(() => this.store.viewportHeight = vv.height);
    });
  }

  @memo
  get macos() {
    return /Macintosh/i.test(navigator.userAgent);
  }

  @HostListener('document:keydown', ['$event'])
  onHotkey(event: KeyboardEvent) {
    let hotkey = this.macos
      ? (event.key === 'Meta' && !event.altKey && !event.ctrlKey && !event.shiftKey)
      : (event.key === 'Control' && !event.altKey && !event.metaKey && !event.shiftKey);
    if (this.store.hotkey !== hotkey) {
      runInAction(() => this.store.hotkey = hotkey);
      if (hotkey) {
        document.body.classList.add('hotkey');
      } else {
        document.body.classList.remove('hotkey');
      }
    }
  }

  @HostListener('window:blur')
  @HostListener('document:keyup')
  removeHotkey() {
    if (this.store.hotkey) {
      runInAction(() => this.store.hotkey = false);
      document.body.classList.remove('hotkey');
    }
  }

  @HostListener('window:offline')
  offline() {
    if (!this.store.offline) {
      runInAction(() => this.store.offline = true);
    }
  }


  @HostListener('window:online')
  online() {
    if (this.store.offline) {
      runInAction(() => this.store.offline = false);
    }
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
