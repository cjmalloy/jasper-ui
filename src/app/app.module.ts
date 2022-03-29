import { APP_INITIALIZER, NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
import { ConfigService } from "./service/config.service";
import { HomePage } from "./page/home/home.component";
import { PagedComponent } from "./component/paged/paged.component";
import { RefListItemComponent } from "./component/ref-list-item/ref-list-item.component";
import { DebugInterceptor } from "./http/debug.interceptor";
import { SubscriptionBarComponent } from './component/subscription-bar/subscription-bar.component';

@NgModule({
  declarations: [
    AppComponent,
    HomePage,
    PagedComponent,
    RefListItemComponent,
    SubscriptionBarComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
  ],
  providers: [
    ConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: (config: ConfigService) => () => config.load(),
      deps: [ConfigService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DebugInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
