import { DragDropModule } from '@angular/cdk/drag-drop';
import { FullscreenOverlayContainer, OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { QRCodeModule } from 'angularx-qrcode';
import { MobxAngularModule } from 'mobx-angular';
import { MarkdownModule } from 'ngx-markdown';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { retry, switchMap } from 'rxjs';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BackupListComponent } from './component/backup-list/backup-list.component';
import { BackupComponent } from './component/backup/backup.component';
import { BlogEntryComponent } from './component/blog-entry/blog-entry.component';
import { BlogComponent } from './component/blog/blog.component';
import { CommentEditComponent } from './component/comment-edit/comment-edit.component';
import { CommentListComponent } from './component/comment-list/comment-list.component';
import { CommentReplyComponent } from './component/comment-reply/comment-reply.component';
import { CommentComponent } from './component/comment/comment.component';
import { EmbedComponent } from './component/embed/embed.component';
import { ExtListComponent } from './component/ext-list/ext-list.component';
import { ExtComponent } from './component/ext/ext.component';
import { ForceDirectedComponent } from './component/graph/force-directed/force-directed.component';
import { KanbanCardComponent } from './component/kanban-card/kanban-card.component';
import { KanbanColumnComponent } from './component/kanban-column/kanban-column.component';
import { KanbanComponent } from './component/kanban/kanban.component';
import { ListEditorComponent } from './component/list-editor/list-editor.component';
import { LoadingComponent } from './component/loading/loading.component';
import { LoginPopupComponent } from './component/login-popup/login-popup.component';
import { MdComponent } from './component/md/md.component';
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
import { ExtFormComponent } from './form/ext/ext.component';
import { LinksFormComponent } from './form/links/links.component';
import { ArchiveFormComponent } from './form/plugin/archive/archive.component';
import { AudioFormComponent } from './form/plugin/audio/audio.component';
import { CommentFormComponent } from './form/plugin/comment/comment.component';
import { EmbedFormComponent } from './form/plugin/embed/embed.component';
import { FeedFormComponent } from './form/plugin/feed/feed.component';
import { ImageFormComponent } from './form/plugin/image/image.component';
import { OriginFormComponent } from './form/plugin/origin/origin.component';
import { PdfFormComponent } from './form/plugin/pdf/pdf.component';
import { QrFormComponent } from './form/plugin/qr/qr.component';
import { ThumbnailFormComponent } from './form/plugin/thumbnail/thumbnail.component';
import { VideoFormComponent } from './form/plugin/video/video.component';
import { PluginsFormComponent } from './form/plugins/plugins.component';
import { QtagsFormComponent } from './form/qtags/qtags.component';
import { QueriesFormComponent } from './form/queries/queries.component';
import { RefFormComponent } from './form/ref/ref.component';
import { TagsFormComponent } from './form/tags/tags.component';
import { ThemesFormComponent } from './form/themes/themes.component';
import { UserFormComponent } from './form/user/user.component';
import { UsersFormComponent } from './form/users/users.component';
import { DebugInterceptor } from './http/debug.interceptor';
import { CreateExtPage } from './page/create/ext/ext.component';
import { CreateProfilePage } from './page/create/profile/profile.component';
import { CreateUserPage } from './page/create/user/user.component';
import { HomePage } from './page/home/home.component';
import { InboxAllPage } from './page/inbox/all/all.component';
import { InboxPage } from './page/inbox/inbox.component';
import { InboxInvoicesPage } from './page/inbox/invoices/invoices.component';
import { InboxSentPage } from './page/inbox/sent/sent.component';
import { InboxUnreadPage } from './page/inbox/unread/unread.component';
import { LoginPage } from './page/login/login.component';
import { RefAltsComponent } from './page/ref/alts/alts.component';
import { RefCommentsComponent } from './page/ref/comments/comments.component';
import { RefGraphComponent } from './page/ref/graph/graph.component';
import { RefMissingComponent } from './page/ref/missing/missing.component';
import { RefPage } from './page/ref/ref.component';
import { RefRemotesComponent } from './page/ref/remotes/remotes.component';
import { RefResponsesComponent } from './page/ref/responses/responses.component';
import { RefSourcesComponent } from './page/ref/sources/sources.component';
import { SettingsBackupPage } from './page/settings/backup/backup.component';
import { SettingsExtPage } from './page/settings/ext/ext.component';
import { SettingsFeedPage } from './page/settings/feed/feed.component';
import { SettingsOriginPage } from './page/settings/origin/origin.component';
import { SettingsPasswordPage } from './page/settings/password/password.component';
import { SettingsPluginPage } from './page/settings/plugin/plugin.component';
import { SettingsProfilePage } from './page/settings/profile/profile.component';
import { SettingsPage } from './page/settings/settings.component';
import { SettingsSetupPage } from './page/settings/setup/setup.component';
import { SettingsTemplatePage } from './page/settings/template/template.component';
import { SettingsUserPage } from './page/settings/user/user.component';
import { SubmitDmPage } from './page/submit/dm/dm.component';
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

const loadFactory = (config: ConfigService, admin: AdminService, account: AccountService) => () =>
  config.load$.pipe(
    switchMap(() => admin.init$),
    retry({ delay: 1000 }),
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
    AutofocusDirective,
    CreateExtPage,
    CreateProfilePage,
    EditTagPage,
    LoadingComponent,
    SettingsPage,
    SettingsFeedPage,
    SettingsUserPage,
    SettingsExtPage,
    SettingsSetupPage,
    SettingsOriginPage,
    SettingsPluginPage,
    SettingsTemplatePage,
    TagListComponent,
    TagComponent,
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
    PluginsFormComponent,
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
    SettingsBackupPage,
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
    BlogComponent,
    BlogEntryComponent,
    ExtFormComponent,
    ExtComponent,
    ExtListComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MobxAngularModule,
    MarkdownModule.forRoot(),
    QRCodeModule,
    MonacoEditorModule.forRoot(),
    DragDropModule,
    OverlayModule,
  ],
  providers: [
    ConfigService,
    { provide: OverlayContainer, useClass: FullscreenOverlayContainer },
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
