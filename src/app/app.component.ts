import { AfterViewInit, Component, HostBinding, HostListener, isDevMode, ViewContainerRef } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { autorun, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { LoginPopupComponent } from './component/login-popup/login-popup.component';
import { SubscriptionBarComponent } from './component/subscription-bar/subscription-bar.component';
import { pdfPlugin, pdfUrl } from './mods/media/pdf';
import { pipPlugin } from './mods/system/pip';
import { archivePlugin, archiveUrl } from './mods/tools/archive';
import { AdminService } from './service/admin.service';
import { OriginService } from './service/api/origin.service';
import { ProxyService } from './service/api/proxy.service';
import { ScrapeService } from './service/api/scrape.service';
import { ConfigService } from './service/config.service';
import { Store } from './store/store';
import { createPip } from './util/embed';
import { handleVideoKeydown } from './util/keyboard';
import { memo } from './util/memo';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    MobxAngularModule,
    LoginPopupComponent,
    SubscriptionBarComponent,
    RouterOutlet,
  ],
})
export class AppComponent implements AfterViewInit {

  @HostBinding('class.electron')
  electron = this.config.electron;

  debug = !isDevMode() && this.store.account.debug;
  website = 'https://github.com/cjmalloy/jasper-ui';

  pdfPlugin = this.admin.getPlugin('plugin/pdf') as typeof pdfPlugin || undefined;
  archivePlugin = this.admin.getPlugin('plugin/archive') as typeof archivePlugin || undefined;
  pipPlugin = this.admin.getPlugin('plugin/pip') as typeof pipPlugin || undefined;

  constructor(
    public config: ConfigService,
    public store: Store,
    private admin: AdminService,
    private proxy: ProxyService,
    private origins: OriginService,
    private scrape: ScrapeService,
    private router: Router,
    private vc: ViewContainerRef,
  ) {
    document.body.style.height = '';
    if (!this.store.account.debug && this.config.version) this.website = 'https://github.com/cjmalloy/jasper-ui/releases/tag/' + this.config.version;
    window.addEventListener('keyup', event => {
      const hotkey = !this.hotkeyActive(event) || this.hotkey(event.key);
      if (this.store.hotkey && hotkey) {
        runInAction(() => this.store.hotkey = false);
        document.body.classList.remove('hotkey');
      }
    }, { capture: true });
    window.addEventListener('keydown', event => {
      const hotkey = this.hotkeyActive(event) || this.hotkey(event.key);
      if (this.store.hotkey !== hotkey) {
        runInAction(() => this.store.hotkey = hotkey);
        document.body.classList.toggle('hotkey', hotkey);
      }
      if (document.activeElement instanceof HTMLVideoElement) {
        handleVideoKeydown(event, document.activeElement);
      } else if (document.activeElement?.querySelectorAll('video')?.[0]) {
        handleVideoKeydown(event, document.activeElement.querySelectorAll('video')[0]);
      }
    }, { capture: true });
    window.addEventListener('pointerenter', event => {
      const hotkey = this.hotkeyActive(event);
      if (this.store.hotkey !== hotkey) {
        runInAction(() => this.store.hotkey = hotkey);
        document.body.classList.toggle('hotkey', hotkey);
      }
    }, { capture: true });
    window.addEventListener('pointerout', event => {
      const hotkey = this.hotkeyActive(event);
      if (this.store.hotkey !== hotkey) {
        runInAction(() => this.store.hotkey = hotkey);
        document.body.classList.toggle('hotkey', hotkey);
      }
    }, { capture: true });
  }

  ngAfterViewInit() {
    if (this.pdfPlugin) {
      autorun(() => {
        if (this.store.eventBus.event === 'pdf') {
          let pdf = pdfUrl(this.pdfPlugin, this.store.eventBus.ref, this.store.eventBus.repost);
          if (!pdf) return;
          if (pdf.url.startsWith('cache:') || this.pdfPlugin!.config?.proxy) pdf.url = this.proxy.getFetch(pdf.url, pdf.origin, pdf.title + (pdf.title.toLowerCase().endsWith('.pdf') ? '' : '.pdf'));
          open(pdf.url, '_blank');
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
    if (this.pipPlugin) {
      autorun(() => {
        if (this.store.eventBus.event === 'pip') {
          createPip(this.vc, this.store.eventBus.ref!, this.pipPlugin?.config?.windowConfig);
        }
      });
    }

    window.visualViewport?.addEventListener('resize', event => {
      const vv = event?.target as VisualViewport;
      runInAction(() => this.store.viewportHeight = vv.height);
    });
  }

  @memo
  get macos() {
    return /Macintosh/i.test(navigator.userAgent);
  }

  hotkey(key: string) {
    return this.macos ? key === 'Meta' : key === 'Control';
  }

  hotkeyActive(event: KeyboardEvent | PointerEvent) {
    return this.macos ? event.metaKey : event.ctrlKey;
  }

  @HostListener('window:blur')
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

  @HostListener('window:paste', ['$event'])
  paste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind === 'file') {
        this.upload(event, items);
        this.removeHotkey();
        return;
      }
    }
  }

  dragOver(event: DragEvent) {
    event.preventDefault();
  }

  upload(event: Event, items?: DataTransferItemList) {
    if (!items) return;
    if ((event.target as HTMLElement)?.tagName === 'INPUT') return;
    if ((event.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    event.preventDefault();
    const files = [] as any;
    for (let i = 0; i < items.length; i++) {
      const d = items[i];
      if (d?.kind === 'file') {
        files.push(d.getAsFile());
      }
    }
    if (!files.length) return;
    this.store.submit.addFiles(files);
    if (!this.store.submit.upload) {
      this.router.navigate(['/submit/upload'], { queryParams: { tag: this.store.view.queryTags }});
    }
  }

}
