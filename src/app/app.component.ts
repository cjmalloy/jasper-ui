import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  isDevMode,
  ViewContainerRef
} from '@angular/core';
import { NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LoginPopupComponent } from './component/login-popup/login-popup.component';
import { SubscriptionBarComponent } from './component/subscription-bar/subscription-bar.component';
import { UserClipboardComponent } from './component/user-clipboard/user-clipboard.component';
import { userClipboardPlugin } from './mods/clipboard';
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

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  host: {
    '[class.electron]': 'electron',
    '(window:blur)': 'removeHotkey()',
    '(window:offline)': 'offline()',
    '(window:online)': 'online()',
    '(window:paste)': 'paste($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoginPopupComponent,
    SubscriptionBarComponent,
    UserClipboardComponent,
    RouterOutlet,
  ],
})
export class AppComponent implements AfterViewInit {

  electron = this.config.electron;

  debug = !isDevMode() && this.store.account.debug;
  website = 'https://github.com/cjmalloy/jasper-ui';

  pdfPlugin = this.admin.getPlugin('plugin/pdf') as typeof pdfPlugin || undefined;
  archivePlugin = this.admin.getPlugin('plugin/archive') as typeof archivePlugin || undefined;
  pipPlugin = this.admin.getPlugin('plugin/pip') as typeof pipPlugin || undefined;
  userClipboardPlugin = this.admin.getPlugin('plugin/user/clipboard') as typeof userClipboardPlugin || undefined;

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
        this.store.hotkey = false;
        document.body.classList.remove('hotkey');
      }
    }, { capture: true });
    window.addEventListener('keydown', event => {
      const hotkey = this.hotkeyActive(event) || this.hotkey(event.key);
      if (this.store.hotkey !== hotkey) {
        this.store.hotkey = hotkey;
        document.body.classList.toggle('hotkey', hotkey);
      }
    }, { capture: true });
    window.addEventListener('pointerenter', event => {
      const hotkey = this.hotkeyActive(event);
      if (this.store.hotkey !== hotkey) {
        this.store.hotkey = hotkey;
        document.body.classList.toggle('hotkey', hotkey);
      }
    }, { capture: true });
    window.addEventListener('pointerout', event => {
      const hotkey = this.hotkeyActive(event);
      if (this.store.hotkey !== hotkey) {
        this.store.hotkey = hotkey;
        document.body.classList.toggle('hotkey', hotkey);
      }
    }, { capture: true });
  }

  ngAfterViewInit() {
    this.store.eventBus.events.subscribe(({ event, ref, repost }) => {
      if (event === 'pdf' && this.pdfPlugin) {
        let pdf = pdfUrl(this.pdfPlugin, ref, repost);
        if (!pdf) return;
        if (pdf.url.startsWith('cache:') || this.pdfPlugin.config?.proxy) pdf.url = this.proxy.getFetch(pdf.url, pdf.origin, pdf.title + (pdf.title.toLowerCase().endsWith('.pdf') ? '' : '.pdf'));
        open(pdf.url, '_blank');
      }
      if (event === 'archive' && this.archivePlugin) {
        let url = archiveUrl(this.archivePlugin, ref, repost);
        if (!url) return;
        open(url, '_blank');
      }
      if (event === 'pip' && this.pipPlugin) {
        createPip(this.vc, ref!, this.pipPlugin.config?.windowConfig);
      }
    });
    window.visualViewport?.addEventListener('resize', event => {
      const vv = event?.target as VisualViewport;
      this.store.viewportHeight = vv.height;
    });
    let currentNavigationId = 0;
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe((event: NavigationStart) => {
      const isLinkClick = event.navigationTrigger === 'imperative';
      const isForwardButton = event.navigationTrigger === 'popstate' &&
        event.restoredState &&
        event.restoredState.navigationId > currentNavigationId;
      this.store.view.back = !isLinkClick && !isForwardButton;
      currentNavigationId = event.restoredState?.navigationId ?? event.id;
    });
  }

  readonly macos = /Macintosh/i.test(navigator.userAgent);

  hotkey(key: string) {
    return this.macos ? key === 'Meta' : key === 'Control';
  }

  hotkeyActive(event: KeyboardEvent | PointerEvent) {
    return this.macos ? event.metaKey : event.ctrlKey;
  }

  removeHotkey() {
    if (this.store.hotkey) {
      this.store.hotkey = false;
      document.body.classList.remove('hotkey');
    }
  }

  offline() {
    if (!this.store.offline) {
      this.store.offline = true;
    }
  }

  online() {
    if (this.store.offline) {
      this.store.offline = false;
    }
  }

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
