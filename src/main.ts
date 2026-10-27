/// <reference types="@angular/localize" />

import { FullscreenOverlayContainer, OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import {
  ApplicationInitStatus,
  ApplicationRef,
  inject,
  provideAppInitializer,
  provideCheckNoChangesConfig,
  provideZonelessChangeDetection
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, UrlSerializer, withRouterConfig } from '@angular/router';
import { provideServiceWorker, SwRegistrationOptions } from '@angular/service-worker';
import { Settings } from 'luxon';
import { NGX_MONACO_EDITOR_CONFIG } from 'ngx-monaco-editor';
import { filter, from, race, retry, switchMap, timer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppComponent } from './app/app.component';
import { CustomUrlSerializer, routes } from './app/app.routes';
import { provideJasperFormly } from './app/formly/formly.config';
import { authInterceptor } from './app/http/auth.interceptor';
import { csrfInterceptor } from './app/http/csrf.interceptor';
import { rateLimitInterceptor } from './app/http/rate-limit.interceptor';
import { AccountService } from './app/service/account.service';
import { AdminService } from './app/service/admin.service';
import { ExtService } from './app/service/api/ext.service';
import { OEmbedService } from './app/service/api/oembed.service';
import { ScrapeService } from './app/service/api/scrape.service';
import { StompService } from './app/service/api/stomp.service';
import { ConfigService } from './app/service/config.service';
import { DebugService } from './app/service/debug.service';
import { ModService } from './app/service/mod.service';
import { OriginMapService } from './app/service/origin-map.service';
import { environment } from './environments/environment';

function load() {
  const config = inject(ConfigService);
  const debug = inject(DebugService);
  const admin = inject(AdminService);
  const account = inject(AccountService);
  const origins = inject(OriginMapService);
  const mods = inject(ModService);
  const exts = inject(ExtService);
  const stomp = inject(StompService);
  // Listen for *:defaults before the first admin run fires it
  inject(OEmbedService);
  inject(ScrapeService);
  return config.load$.pipe(
    tap(() => stomp.initialize()),
    tap(() => console.log('-{1}- Loading Jasper')),
    tap(() => {
      if (!config.pwa) {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration()
            .then(registration => registration?.unregister())
            .catch(err => console.error(err));
        }
        if ('caches' in window) {
          caches.keys()
            .then(keys => keys.filter(key => key.startsWith('ngsw:')).forEach(key => caches.delete(key)))
            .catch(err => console.error(err));
        }
      }
    }),
    tap(() => Settings.defaultLocale = document.documentElement.lang),
    switchMap(() => debug.init$),
    tap(() => console.log('-{2}- Authorizing')),
    switchMap(() => account.whoAmI$.pipe(
      retry({
        delay: (_, retryCount: number) =>
          // 1 second to 17 minutes in 10 steps
          timer(1000 * Math.pow(2, Math.min(10, retryCount)))
      })
    )),
    tap(() => console.log('-{3}- Checking if first run as admin')),
    switchMap(() => account.initExt$),
    tap(() => console.log('-{4}- Loading plugins and templates')),
    switchMap(() => admin.init$),
    tap(() => console.log('-{5}- Loading account information')),
    switchMap(() => account.init$),
    tap(() => console.log('-{6}- Loading origins')),
    switchMap(() => origins.init$),
    tap(() => console.log('-{7}- Prefetching Exts')),
    switchMap(() => exts.init$),
    tap(() => console.log('-{8}- Loading mods')),
    switchMap(() => mods.init$),
    tap(() => console.log('-{9}- Ready')),
  );
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    ...(environment.checkNoChanges ? [provideCheckNoChangesConfig({ exhaustive: true })] : []),
    provideRouter(routes, withRouterConfig({
      paramsInheritanceStrategy: 'always',
      onSameUrlNavigation: 'reload',
    })),
    { provide: UrlSerializer, useClass: CustomUrlSerializer },
    { provide: NGX_MONACO_EDITOR_CONFIG, useValue: {} },
    provideJasperFormly(),
    provideServiceWorker('ngsw-worker.js'),
    {
      provide: SwRegistrationOptions,
      useFactory: (): SwRegistrationOptions => {
        const config = inject(ConfigService);
        const init = inject(ApplicationInitStatus);
        const app = inject(ApplicationRef);
        return {
          scope: '.',
          enabled: environment.production && location.hostname != 'localhost',
          // Wait for config.json to load, then register the ServiceWorker if enabled
          // as soon as the application is stable or after 30 seconds (whichever comes first).
          registrationStrategy: () => from(init.donePromise).pipe(
            filter(() => config.pwa),
            switchMap(() => race(from(app.whenStable()), timer(30_000))),
          ),
        };
      },
    },
    provideHttpClient(withXhr(), withInterceptors([authInterceptor, csrfInterceptor, rateLimitInterceptor])),
    { provide: OverlayContainer, useClass: FullscreenOverlayContainer },
    provideAppInitializer(load),
  ]
})
  .catch(err => console.error(err));
