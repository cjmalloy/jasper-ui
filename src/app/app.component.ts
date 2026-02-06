import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  HostBinding,
  HostListener,
  inject,
  Injector,
  isDevMode,
  ViewContainerRef
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
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
import { memo } from './util/memo';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [
    LoginPopupComponent,
    SubscriptionBarComponent,
    RouterOutlet,
  ],
})
export class AppComponent implements AfterViewInit {
  private injector = inject(Injector);
  config = inject(ConfigService);
  store = inject(Store);
  private admin = inject(AdminService);
  private proxy = inject(ProxyService);
  private origins = inject(OriginService);
  private scrape = inject(ScrapeService);
  private router = inject(Router);
  private vc = inject(ViewContainerRef);


  @HostBinding('class.electron')
  electron = this.config.electron;

  debug = !isDevMode() && this.store.account.debug;
  website = 'https://github.com/cjmalloy/jasper-ui';

  pdfPlugin = this.admin.getPlugin('plugin/pdf') as typeof pdfPlugin || undefined;
  archivePlugin = this.admin.getPlugin('plugin/archive') as typeof archivePlugin || undefined;
  pipPlugin = this.admin.getPlugin('plugin/pip') as typeof pipPlugin || undefined;

  constructor() {
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
    if (this.pdfPlugin) {
      effect(() => {
        if (this.store.eventBus.event === 'pdf') {
          let pdf = pdfUrl(this.pdfPlugin, this.store.eventBus.ref, this.store.eventBus.repost);
          if (!pdf) return;
          if (pdf.url.startsWith('cache:') || this.pdfPlugin!.config?.proxy) pdf.url = this.proxy.getFetch(pdf.url, pdf.origin, pdf.title + (pdf.title.toLowerCase().endsWith('.pdf') ? '' : '.pdf'));
          open(pdf.url, '_blank');
        }
      }, { injector: this.injector });
    }
    if (this.archivePlugin) {
      effect(() => {
        if (this.store.eventBus.event === 'archive') {
          let url = archiveUrl(this.archivePlugin, this.store.eventBus.ref, this.store.eventBus.repost);
          if (!url) return;
          open(url, '_blank');
        }
      }, { injector: this.injector });
    }
    if (this.pipPlugin) {
      effect(() => {
        if (this.store.eventBus.event === 'pip') {
          createPip(this.vc, this.store.eventBus.ref!, this.pipPlugin?.config?.windowConfig);
        }
      }, { injector: this.injector });
    }
    window.visualViewport?.addEventListener('resize', event => {
      const vv = event?.target as VisualViewport;
      this.store.viewportHeight = vv.height;
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
      this.store.hotkey = false;
      document.body.classList.remove('hotkey');
    }
  }

  @HostListener('window:offline')
  offline() {
    if (!this.store.offline) {
      this.store.offline = true;
    }
  }

  @HostListener('window:online')
  online() {
    if (this.store.offline) {
      this.store.offline = false;
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
