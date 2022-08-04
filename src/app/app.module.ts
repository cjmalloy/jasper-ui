import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { QRCodeModule } from 'angularx-qrcode';
import { MarkdownModule } from 'ngx-markdown';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { switchMap } from 'rxjs';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BackupComponent } from './component/backup/backup.component';
import { CommentEditComponent } from './component/comment-edit/comment-edit.component';
import { CommentListComponent } from './component/comment-list/comment-list.component';
import { CommentReplyComponent } from './component/comment-reply/comment-reply.component';
import { CommentComponent } from './component/comment/comment.component';
import { EmbedComponent } from './component/embed/embed.component';
import { FeedListComponent } from './component/feed-list/feed-list.component';
import { FeedComponent } from './component/feed/feed.component';
import { ForceDirectedComponent } from './component/graph/force-directed/force-directed.component';
import { LoadingComponent } from './component/loading/loading.component';
import { LoginPopupComponent } from './component/login-popup/login-popup.component';
import { OriginListComponent } from './component/origin-list/origin-list.component';
import { OriginComponent } from './component/origin/origin.component';
import { PageControlsComponent } from './component/page-controls/page-controls.component';
import { ProfileListComponent } from './component/profile-list/profile-list.component';
import { ProfileComponent } from './component/profile/profile.component';
import { RefListComponent } from './component/ref-list/ref-list.component';
import { RefComponent } from './component/ref/ref.component';
import { SearchFilterComponent } from './component/search-filter/search-filter.component';
import { SettingsComponent } from './component/settings/settings.component';
import { SidebarComponent } from './component/sidebar/sidebar.component';
import { SubscriptionBarComponent } from './component/subscription-bar/subscription-bar.component';
import { TagListComponent } from './component/tag-list/tag-list.component';
import { TagComponent } from './component/tag/tag.component';
import { UserComponent } from './component/user/user.component';
import { AutofocusDirective } from './directive/autofocus.directive';
import { MdPostDirective } from './directive/md-post.directive';
import { ResizeDirective } from './directive/resize.directive';
import { CodeComponent } from './form/code/code.component';
import { FeedFormComponent } from './form/feed/feed.component';
import { LinksFormComponent } from './form/links/links.component';
import { OriginFormComponent } from './form/origin/origin.component';
import { ArchiveFormComponent } from './form/plugin/archive/archive.component';
import { AudioFormComponent } from './form/plugin/audio/audio.component';
import { CommentFormComponent } from './form/plugin/comment/comment.component';
import { EmbedFormComponent } from './form/plugin/embed/embed.component';
import { ImageFormComponent } from './form/plugin/image/image.component';
import { PdfFormComponent } from './form/plugin/pdf/pdf.component';
import { QrFormComponent } from './form/plugin/qr/qr.component';
import { ThumbnailFormComponent } from './form/plugin/thumbnail/thumbnail.component';
import { VideoFormComponent } from './form/plugin/video/video.component';
import { PluginsComponent } from './form/plugins/plugins.component';
import { QtagsFormComponent } from './form/qtags/qtags.component';
import { QueriesFormComponent } from './form/queries/queries.component';
import { RefFormComponent } from './form/ref/ref.component';
import { TagsFormComponent } from './form/tags/tags.component';
import { UserFormComponent } from './form/user/user.component';
import { UsersFormComponent } from './form/users/users.component';
import { DebugInterceptor } from './http/debug.interceptor';
import { AdminPage } from './page/admin/admin.component';
import { AdminOriginPage } from './page/admin/origin/origin.component';
import { AdminPluginPage } from './page/admin/plugin/plugin.component';
import { AdminSetupPage } from './page/admin/setup/setup.component';
import { AdminTemplatePage } from './page/admin/template/template.component';
import { CreateExtPage } from './page/create/ext/ext.component';
import { CreateOriginPage } from './page/create/origin/origin.component';
import { CreateProfilePage } from './page/create/profile/profile.component';
import { CreateUserPage } from './page/create/user/user.component';
import { HomePage } from './page/home/home.component';
import { InboxAllPage } from './page/inbox/all/all.component';
import { InboxPage } from './page/inbox/inbox.component';
import { InboxInvoicesPage } from './page/inbox/invoices/invoices.component';
import { InboxSentPage } from './page/inbox/sent/sent.component';
import { InboxUnreadPage } from './page/inbox/unread/unread.component';
import { LoginPage } from './page/login/login.component';
import { RefCommentsComponent } from './page/ref/comments/comments.component';
import { RefGraphComponent } from './page/ref/graph/graph.component';
import { RefMissingComponent } from './page/ref/missing/missing.component';
import { RefPage } from './page/ref/ref.component';
import { RefResponsesComponent } from './page/ref/responses/responses.component';
import { RefSourcesComponent } from './page/ref/sources/sources.component';
import { SettingsExtPage } from './page/settings/ext/ext.component';
import { SettingsFeedPage } from './page/settings/feed/feed.component';
import { SettingsPasswordPage } from './page/settings/password/password.component';
import { SettingsProfilePage } from './page/settings/profile/profile.component';
import { SettingsPage } from './page/settings/settings.component';
import { SettingsUserPage } from './page/settings/user/user.component';
import { SubmitDmPage } from './page/submit/dm/dm.component';
import { SubmitFeedPage } from './page/submit/feed/feed.component';
import { SubmitInvoicePage } from './page/submit/invoice/invoice.component';
import { SubmitPage } from './page/submit/submit.component';
import { SubmitTextPage } from './page/submit/text/text.component';
import { SubmitWebPage } from './page/submit/web/web.component';
import { EditTagPage } from './page/tag/edit/edit.component';
import { TagPage } from './page/tag/tag.component';
import { EmbedPipe } from './pipe/embed.pipe';
import { SafePipe } from './pipe/safe.pipe';
import { ThumbnailPipe } from './pipe/thumbnail.pipe';
import { AccountService } from './service/account.service';
import { AdminService } from './service/admin.service';
import { ConfigService } from './service/config.service';
import { ThemesFormComponent } from './form/themes/themes.component';
import { ListEditorComponent } from './component/list-editor/list-editor.component';
import { AdminBackupPage } from './page/admin/backup/backup.component';
import { BackupListComponent } from './component/backup-list/backup-list.component';
import { RefAltsComponent } from './page/ref/alts/alts.component';
import { RefRemotesComponent } from './page/ref/remotes/remotes.component';
import { KanbanComponent } from './component/kanban/kanban.component';
import { KanbanColumnComponent } from './component/kanban-column/kanban-column.component';
import { KanbanCardComponent } from './component/kanban-card/kanban-card.component';
import { MdComponent } from './component/md/md.component';

const loadFactory = (config: ConfigService, admin: AdminService, account: AccountService) => () =>
  config.load$.pipe(
    switchMap(() => admin.init$),
    switchMap(() => account.init$),
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
    RefCommentsComponent,
    RefResponsesComponent,
    RefSourcesComponent,
    RefGraphComponent,
    CommentComponent,
    SettingsComponent,
    InboxPage,
    InboxAllPage,
    InboxUnreadPage,
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
    CreateProfilePage,
    CreateOriginPage,
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
    SubmitDmPage,
    SubmitInvoicePage,
    InboxInvoicesPage,
    InboxSentPage,
    SearchFilterComponent,
    EmbedComponent,
    SafePipe,
    EmbedPipe,
    ThumbnailPipe,
    ResizeDirective,
    LoginPage,
    LoginPopupComponent,
    TagsFormComponent,
    LinksFormComponent,
    QtagsFormComponent,
    AudioFormComponent,
    PluginsComponent,
    VideoFormComponent,
    ImageFormComponent,
    EmbedFormComponent,
    QrFormComponent,
    CommentFormComponent,
    ThumbnailFormComponent,
    RefMissingComponent,
    ArchiveFormComponent,
    PdfFormComponent,
    SettingsProfilePage,
    ProfileListComponent,
    ProfileComponent,
    SettingsPasswordPage,
    RefFormComponent,
    MdPostDirective,
    CodeComponent,
    QueriesFormComponent,
    UsersFormComponent,
    ThemesFormComponent,
    ListEditorComponent,
    AdminBackupPage,
    BackupComponent,
    BackupListComponent,
    UserFormComponent,
    OriginFormComponent,
    FeedFormComponent,
    RefAltsComponent,
    RefRemotesComponent,
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    MdComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MarkdownModule.forRoot(),
    QRCodeModule,
    MonacoEditorModule.forRoot(),
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
