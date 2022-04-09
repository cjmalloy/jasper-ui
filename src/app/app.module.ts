import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { MarkdownModule } from 'ngx-markdown';
import { mergeMap } from 'rxjs';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CommentEditComponent } from './component/comment-edit/comment-edit.component';
import { CommentListComponent } from './component/comment-list/comment-list.component';
import { CommentReplyComponent } from './component/comment-reply/comment-reply.component';
import { CommentComponent } from './component/comment/comment.component';
import { FeedListComponent } from './component/feed-list/feed-list.component';
import { FeedComponent } from './component/feed/feed.component';
import { ForceDirectedComponent } from './component/graph/force-directed/force-directed.component';
import { LoadingComponent } from './component/loading/loading.component';
import { OriginListComponent } from './component/origin-list/origin-list.component';
import { OriginComponent } from './component/origin/origin.component';
import { PageControlsComponent } from './component/page-controls/page-controls.component';
import { RefListComponent } from './component/ref-list/ref-list.component';
import { RefComponent } from './component/ref/ref.component';
import { SettingsComponent } from './component/settings/settings.component';
import { SidebarComponent } from './component/sidebar/sidebar.component';
import { SubscriptionBarComponent } from './component/subscription-bar/subscription-bar.component';
import { TagListComponent } from './component/tag-list/tag-list.component';
import { TagComponent } from './component/tag/tag.component';
import { UserComponent } from './component/user/user.component';
import { AutofocusDirective } from './directive/autofocus.directive';
import { DebugInterceptor } from './http/debug.interceptor';
import { AdminPage } from './page/admin/admin.component';
import { AdminOriginPage } from './page/admin/origin/origin.component';
import { AdminPluginPage } from './page/admin/plugin/plugin.component';
import { AdminSetupPage } from './page/admin/setup/setup.component';
import { AdminTemplatePage } from './page/admin/template/template.component';
import { CreateExtPage } from './page/create/ext/ext.component';
import { CreateUserPage } from './page/create/user/user.component';
import { HomePage } from './page/home/home.component';
import { AllComponent } from './page/inbox/all/all.component';
import { InboxPage } from './page/inbox/inbox.component';
import { UnreadComponent } from './page/inbox/unread/unread.component';
import { CommentsComponent } from './page/ref/comments/comments.component';
import { GraphComponent } from './page/ref/graph/graph.component';
import { RefPage } from './page/ref/ref.component';
import { ResponsesComponent } from './page/ref/responses/responses.component';
import { SourcesComponent } from './page/ref/sources/sources.component';
import { SettingsExtPage } from './page/settings/ext/ext.component';
import { SettingsFeedPage } from './page/settings/feed/feed.component';
import { SettingsPage } from './page/settings/settings.component';
import { SettingsUserPage } from './page/settings/user/user.component';
import { SubmitFeedPage } from './page/submit/feed/feed.component';
import { SubmitPage } from './page/submit/submit.component';
import { SubmitTextPage } from './page/submit/text/text.component';
import { SubmitWebPage } from './page/submit/web/web.component';
import { EditTagPage } from './page/tag/edit/edit.component';
import { TagPage } from './page/tag/tag.component';
import { AccountService } from './service/account.service';
import { AdminService } from './service/admin.service';
import { ConfigService } from './service/config.service';

const loadFactory = (config: ConfigService, admin: AdminService, account: AccountService) => () =>
  config.load$.pipe(
    mergeMap(() => admin.init$),
    mergeMap(() => account.init$),
  );

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
    SubmitFeedPage,
    AutofocusDirective,
    CreateExtPage,
    EditTagPage,
    LoadingComponent,
    AdminPage,
    SettingsPage,
    SettingsFeedPage,
    SettingsUserPage,
    SettingsExtPage,
    AdminSetupPage,
    AdminOriginPage,
    AdminPluginPage,
    AdminTemplatePage,
    TagListComponent,
    TagComponent,
    OriginListComponent,
    OriginComponent,
    FeedComponent,
    FeedListComponent,
    UserComponent,
    CreateUserPage,
    ForceDirectedComponent,
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
      deps: [ConfigService, AdminService, AccountService],
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: DebugInterceptor,
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
