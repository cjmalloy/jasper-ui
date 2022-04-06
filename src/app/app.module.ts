import { APP_INITIALIZER, NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
import { ConfigService } from "./service/config.service";
import { HomePage } from "./page/home/home.component";
import { DebugInterceptor } from "./http/debug.interceptor";
import { SubscriptionBarComponent } from "./component/subscription-bar/subscription-bar.component";
import { RefListComponent } from "./component/ref-list/ref-list.component";
import { TagPage } from "./page/tag/tag.component";
import { RefPage } from "./page/ref/ref.component";
import { CommentsComponent } from "./page/ref/comments/comments.component";
import { ResponsesComponent } from "./page/ref/responses/responses.component";
import { SourcesComponent } from "./page/ref/sources/sources.component";
import { GraphComponent } from "./page/ref/graph/graph.component";
import { RefComponent } from "./component/ref/ref.component";
import { CommentComponent } from "./component/comment/comment.component";
import { SettingsComponent } from "./component/settings/settings.component";
import { InboxPage } from "./page/inbox/inbox.component";
import { AllComponent } from "./page/inbox/all/all.component";
import { UnreadComponent } from "./page/inbox/unread/unread.component";
import { AccountService } from "./service/account.service";
import { mergeMap } from "rxjs";
import { CommentListComponent } from "./component/comment-list/comment-list.component";
import { SidebarComponent } from "./component/sidebar/sidebar.component";
import { PageControlsComponent } from "./component/page-controls/page-controls.component";
import { SubmitPage } from "./page/submit/submit.component";
import { SubmitWebPage } from "./page/submit/web/web.component";
import { SubmitTextPage } from "./page/submit/text/text.component";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { CommentReplyComponent } from "./component/comment-reply/comment-reply.component";
import { CommentEditComponent } from "./component/comment-edit/comment-edit.component";
import { AutofocusDirective } from "./directive/autofocus.directive";
import { MarkdownModule } from "ngx-markdown";

const loadFactory = (config: ConfigService, account: AccountService) => () =>
  config.load().pipe(
    mergeMap(() => account.init())
  )

@NgModule({
  declarations: [
    AppComponent,
    SubscriptionBarComponent,
    HomePage,
    RefListComponent,
    RefComponent,
    TagPage,
    RefPage,
    CommentsComponent,
    ResponsesComponent,
    SourcesComponent,
    GraphComponent,
    CommentComponent,
    SettingsComponent,
    InboxPage,
    AllComponent,
    UnreadComponent,
    PageControlsComponent,
    CommentListComponent,
    CommentReplyComponent,
    CommentEditComponent,
    SidebarComponent,
    SubmitPage,
    SubmitWebPage,
    SubmitTextPage,
    AutofocusDirective,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MarkdownModule.forRoot(),
  ],
  providers: [
    ConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: loadFactory,
      deps: [ConfigService, AccountService],
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
