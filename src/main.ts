/// <reference types="@angular/localize" />

import { enableProdMode, APP_INITIALIZER, isDevMode, importProvidersFrom } from '@angular/core';
import { platformBrowser, HAMMER_GESTURE_CONFIG, BrowserModule, HammerModule, bootstrapApplication } from '@angular/platform-browser';


import { environment } from './environments/environment';

import 'hammerjs';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './app/http/auth.interceptor';
import { CsrfInterceptor } from './app/http/csrf.interceptor';
import { RateLimitInterceptor } from './app/http/rate-limit.interceptor';
import { OverlayContainer, FullscreenOverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { HammerConfig } from './app/hammer.config';
import { ConfigService } from './app/service/config.service';
import { DebugService } from './app/service/debug.service';
import { AdminService } from './app/service/admin.service';
import { AccountService } from './app/service/account.service';
import { OriginMapService } from './app/service/origin-map.service';
import { ModService } from './app/service/mod.service';
import { ExtService } from './app/service/api/ext.service';
import { tap } from 'rxjs/operators';
import { Settings } from 'luxon';
import { switchMap, retry, timer } from 'rxjs';
import { AppRoutingModule } from './app/app-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MobxAngularModule } from 'mobx-angular';
import { MarkdownModule } from 'ngx-markdown';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormlyModule } from '@ngx-formly/core';
import { JasperFormlyModule } from './app/formly/formly.module';
import { ServiceWorkerModule } from '@angular/service-worker';
import { AppComponent } from './app/app.component';

const loadFactory = (config: ConfigService, debug: DebugService, admin: AdminService, account: AccountService, origins: OriginMapService, mods: ModService, exts: ExtService) => () =>
  config.load$.pipe(
    tap(() => console.log('-{1}- Loading Jasper')),
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



if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule, HammerModule, AppRoutingModule, FormsModule, ReactiveFormsModule, MobxAngularModule, MarkdownModule.forRoot(), MonacoEditorModule.forRoot(), DragDropModule, OverlayModule, ScrollingModule, FormlyModule, JasperFormlyModule, ServiceWorkerModule.register('ngsw-worker.js', {
            scope: '.',
            enabled: !isDevMode() && location.hostname != 'localhost',
            // Register the ServiceWorker as soon as the application is stable
            // or after 30 seconds (whichever comes first).
            registrationStrategy: 'registerWhenStable:30000'
        })),
        provideHttpClient(withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: CsrfInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: RateLimitInterceptor, multi: true },
        { provide: OverlayContainer, useClass: FullscreenOverlayContainer },
        { provide: HAMMER_GESTURE_CONFIG, useClass: HammerConfig },
        {
            provide: APP_INITIALIZER,
            useFactory: loadFactory,
            deps: [ConfigService, DebugService, AdminService, AccountService, OriginMapService, ModService, ExtService],
            multi: true,
        },
    ]
})
  .catch(err => console.error(err));
