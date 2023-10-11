import { DragDropModule } from '@angular/cdk/drag-drop';
import { FullscreenOverlayContainer, OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule, HAMMER_GESTURE_CONFIG, HammerModule } from '@angular/platform-browser';
import { FormlyModule } from '@ngx-formly/core';
import { OAuthModule } from 'angular-oauth2-oidc';
import { MobxAngularModule } from 'mobx-angular';
import { MarkdownModule } from 'ngx-markdown';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { retry, switchMap, timer } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BackupListComponent } from './component/backup/backup-list/backup-list.component';
import { BackupComponent } from './component/backup/backup.component';
import { BlogEntryComponent } from './component/blog/blog-entry/blog-entry.component';
import { BlogComponent } from './component/blog/blog.component';
import { BulkComponent } from './component/bulk/bulk.component';
import { ChatEntryComponent } from './component/chat/chat-entry/chat-entry.component';
import { ChatComponent } from './component/chat/chat.component';
import { ChessComponent } from './component/chess/chess.component';
import { CommentEditComponent } from './component/comment/comment-edit/comment-edit.component';
import { CommentReplyComponent } from './component/comment/comment-reply/comment-reply.component';
import { CommentThreadComponent } from './component/comment/comment-thread/comment-thread.component';
import { CommentComponent } from './component/comment/comment.component';
import { ThreadSummaryComponent } from './component/comment/thread-summary/thread-summary.component';
import { DebugComponent } from './component/debug/debug.component';
import { EditorComponent } from './component/editor/editor.component';
import { ExtListComponent } from './component/ext/ext-list/ext-list.component';
import { ExtComponent } from './component/ext/ext.component';
import { FilterComponent } from './component/filter/filter.component';
import { FileComponent } from './component/folder/file/file.component';
import { FolderComponent } from './component/folder/folder.component';
import { SubfolderComponent } from './component/folder/subfolder/subfolder.component';
import { ForceDirectedComponent } from './component/graph/force-directed/force-directed.component';
import { KanbanCardComponent } from './component/kanban/kanban-card/kanban-card.component';
import { KanbanColumnComponent } from './component/kanban/kanban-column/kanban-column.component';
import { KanbanComponent } from './component/kanban/kanban.component';
import { LensComponent } from './component/lens/lens.component';
import { ListEditorComponent } from './component/list-editor/list-editor.component';
import { LoadingComponent } from './component/loading/loading.component';
import { LoginPopupComponent } from './component/login-popup/login-popup.component';
import { MdComponent } from './component/md/md.component';
import { MobileTabSelectComponent } from './component/mobile-tab-select/mobile-tab-select.component';
import { NavComponent } from './component/nav/nav.component';
import { PageControlsComponent } from './component/page-controls/page-controls.component';
import { PlaylistComponent } from './component/playlist/playlist.component';
import { PluginListComponent } from './component/plugin/plugin-list/plugin-list.component';
import { PluginComponent } from './component/plugin/plugin.component';
import { QrComponent } from './component/qr/qr.component';
import { QueryComponent } from './component/query/query.component';
import { RefListComponent } from './component/ref/ref-list/ref-list.component';
import { RefComponent } from './component/ref/ref.component';
import { SearchComponent } from './component/search/search.component';
import { SelectPluginComponent } from './component/select-plugin/select-plugin.component';
import { SelectTemplateComponent } from './component/select-template/select-template.component';
import { SettingsComponent } from './component/settings/settings.component';
import { SidebarComponent } from './component/sidebar/sidebar.component';
import { SortComponent } from './component/sort/sort.component';
import { SubscriptionBarComponent } from './component/subscription-bar/subscription-bar.component';
import { TemplateListComponent } from './component/template/template-list/template-list.component';
import { TemplateComponent } from './component/template/template.component';
import { TodoItemComponent } from './component/todo/item/item.component';
import { TodoComponent } from './component/todo/todo.component';
import { UserListComponent } from './component/user/user-list/user-list.component';
import { UserComponent } from './component/user/user.component';
import { ViewerComponent } from './component/viewer/viewer.component';
import { ActionLabelDirective } from './directive/action-label.directive';
import { AutofocusDirective } from './directive/autofocus.directive';
import { FillWidthDirective } from './directive/fill-width.directive';
import { ImageDimDirective } from './directive/image-dim.directive';
import { InputDoneDirective } from './directive/input-done.directive';
import { LimitWidthDirective } from './directive/limit-width.directive';
import { MdPostDirective } from './directive/md-post.directive';
import { PluginInfoUiDirective } from './directive/plugin-info-ui.directive';
import { PluginUiDirective } from './directive/plugin-ui.directive';
import { ResizeHandleDirective } from './directive/resize-handle.directive';
import { ResizeDirective } from './directive/resize.directive';
import { RouterActivateDirective } from './directive/router-activate.directive';
import { TemplateUiDirective } from './directive/template-ui.directive';
import { TitleDirective } from './directive/title.directive';
import { CodeComponent } from './form/code/code.component';
import { ExtFormComponent } from './form/ext/ext.component';
import { JsonComponent } from './form/json/json.component';
import { LinksFormComponent } from './form/links/links.component';
import { PluginFormComponent } from './form/plugin/plugin.component';
import { GenFormComponent } from './form/plugins/gen/gen.component';
import { PluginsFormComponent } from './form/plugins/plugins.component';
import { RefFormComponent } from './form/ref/ref.component';
import { TagsFormComponent } from './form/tags/tags.component';
import { TemplateFormComponent } from './form/template/template.component';
import { ThemesFormComponent } from './form/themes/themes.component';
import { UserFormComponent } from './form/user/user.component';
import { JasperFormlyModule } from './formly/formly.module';
import { HammerConfig } from './hammer.config';
import { ExtPage } from './page/ext/ext.component';
import { HomePage } from './page/home/home.component';
import { InboxAlarmsPage } from './page/inbox/alarms/alarms.component';
import { InboxAllPage } from './page/inbox/all/all.component';
import { InboxDmsPage } from './page/inbox/dms/dms.component';
import { InboxPage } from './page/inbox/inbox.component';
import { InboxModlistPage } from './page/inbox/modlist/modlist.component';
import { InboxSentPage } from './page/inbox/sent/sent.component';
import { InboxUnreadPage } from './page/inbox/unread/unread.component';
import { LoginPage } from './page/login/login.component';
import { RefAltsComponent } from './page/ref/alts/alts.component';
import { RefCommentsComponent } from './page/ref/comments/comments.component';
import { RefPage } from './page/ref/ref.component';
import { RefResponsesComponent } from './page/ref/responses/responses.component';
import { RefSourcesComponent } from './page/ref/sources/sources.component';
import { RefSummaryComponent } from './page/ref/summary/summary.component';
import { RefThreadComponent } from './page/ref/thread/thread.component';
import { RefVersionsComponent } from './page/ref/versions/versions.component';
import { SettingsBackupPage } from './page/settings/backup/backup.component';
import { SettingsMePage } from './page/settings/me/me.component';
import { SettingsPasswordPage } from './page/settings/password/password.component';
import { SettingsPluginPage } from './page/settings/plugin/plugin.component';
import { SettingsRefPage } from './page/settings/ref/ref.component';
import { SettingsPage } from './page/settings/settings.component';
import { SettingsSetupPage } from './page/settings/setup/setup.component';
import { SettingsTemplatePage } from './page/settings/template/template.component';
import { SettingsUserPage } from './page/settings/user/user.component';
import { SubmitDmPage } from './page/submit/dm/dm.component';
import { SubmitInvoicePage } from './page/submit/invoice/invoice.component';
import { SubmitPage } from './page/submit/submit.component';
import { SubmitTextPage } from './page/submit/text/text.component';
import { UploadPage } from './page/submit/upload/upload.component';
import { SubmitWebPage } from './page/submit/web/web.component';
import { TagPage } from './page/tag/tag.component';
import { TagsPage } from './page/tags/tags.component';
import { UserPage } from './page/user/user.component';
import { PluginsPipe } from './pipe/plugins.pipe';
import { SafePipe } from './pipe/safe.pipe';
import { ThumbnailPipe } from './pipe/thumbnail.pipe';
import { AccountService } from './service/account.service';
import { AdminService } from './service/admin.service';
import { AuthnService } from './service/authn.service';
import { ConfigService } from './service/config.service';
import { DebugService } from './service/debug.service';
import { OriginMapService } from './service/origin-map.service';
import { ThemeService } from './service/theme.service';
import { BackgammonComponent } from './component/backgammon/backgammon.component';

const loadFactory = (config: ConfigService, debug: DebugService, authn: AuthnService, admin: AdminService, account: AccountService, origins: OriginMapService, themes: ThemeService) => () =>
  config.load$.pipe(
    tap(() => console.log('-{1}- Loading Jasper')),
    switchMap(() => debug.init$),
    tap(() => console.log('-{2}- Authenticating')),
    switchMap(() => authn.init$),
    tap(() => console.log('-{3}- Authorizing')),
    switchMap(() => account.whoAmI$.pipe(
      retry({
        delay: (_, retryCount: number) =>
          // 1 second to 17 minutes in 10 steps
          timer(1000 * Math.pow(2, Math.min(10, retryCount)))
      })
    )),
    tap(() => console.log('-{4}- Checking if first run as admin')),
    switchMap(() => account.initExt$),
    tap(() => console.log('-{5}- Loading plugins and templates')),
    switchMap(() => admin.init$),
    tap(() => console.log('-{6}- Loading account information')),
    switchMap(() => account.init$),
    tap(() => console.log('-{7}- Loading origins')),
    switchMap(() => origins.init$),
    tap(() => console.log('-{8}- Loading themes')),
    switchMap(() => themes.init$),
    tap(() => console.log('-{9}- Ready')),
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
    RefSummaryComponent,
    RefCommentsComponent,
    RefResponsesComponent,
    RefSourcesComponent,
    CommentComponent,
    SettingsComponent,
    InboxPage,
    InboxAllPage,
    InboxUnreadPage,
    PageControlsComponent,
    ThreadSummaryComponent,
    CommentReplyComponent,
    CommentEditComponent,
    SidebarComponent,
    SubmitPage,
    SubmitWebPage,
    SubmitTextPage,
    AutofocusDirective,
    ExtPage,
    UserPage,
    LoadingComponent,
    SettingsPage,
    SettingsRefPage,
    SettingsUserPage,
    SettingsSetupPage,
    SettingsPluginPage,
    SettingsTemplatePage,
    UserComponent,
    ForceDirectedComponent,
    SubmitDmPage,
    SubmitInvoicePage,
    InboxSentPage,
    SearchComponent,
    EditorComponent,
    ViewerComponent,
    SafePipe,
    ThumbnailPipe,
    ResizeDirective,
    LoginPage,
    LoginPopupComponent,
    TagsFormComponent,
    LinksFormComponent,
    PluginsFormComponent,
    UserListComponent,
    SettingsPasswordPage,
    RefFormComponent,
    MdPostDirective,
    CodeComponent,
    ThemesFormComponent,
    ListEditorComponent,
    SettingsBackupPage,
    BackupComponent,
    BackupListComponent,
    UserFormComponent,
    RefAltsComponent,
    RefVersionsComponent,
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    MdComponent,
    BlogComponent,
    BlogEntryComponent,
    ExtFormComponent,
    ExtComponent,
    ExtListComponent,
    PluginComponent,
    TemplateComponent,
    PluginFormComponent,
    TemplateFormComponent,
    JsonComponent,
    ChatComponent,
    ChatEntryComponent,
    PluginUiDirective,
    TemplateUiDirective,
    GenFormComponent,
    SortComponent,
    FilterComponent,
    QueryComponent,
    BulkComponent,
    QrComponent,
    DebugComponent,
    FillWidthDirective,
    LimitWidthDirective,
    RefThreadComponent,
    MobileTabSelectComponent,
    SelectTemplateComponent,
    FolderComponent,
    SubfolderComponent,
    FileComponent,
    RouterActivateDirective,
    SelectPluginComponent,
    ImageDimDirective,
    ResizeHandleDirective,
    PluginListComponent,
    TemplateListComponent,
    PluginInfoUiDirective,
    CommentThreadComponent,
    InboxDmsPage,
    UploadPage,
    InboxModlistPage,
    ChessComponent,
    TagsPage,
    PluginsPipe,
    ActionLabelDirective,
    TitleDirective,
    InboxAlarmsPage,
    InputDoneDirective,
    SettingsMePage,
    NavComponent,
    LensComponent,
    TodoComponent,
    TodoItemComponent,
    PlaylistComponent,
    BackgammonComponent,
  ],
  imports: [
    BrowserModule,
    HammerModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MobxAngularModule,
    MarkdownModule.forRoot(),
    MonacoEditorModule.forRoot(),
    DragDropModule,
    OverlayModule,
    ScrollingModule,
    FormlyModule,
    JasperFormlyModule,
    OAuthModule.forRoot({
      resourceServer: {
        sendAccessToken: false,
      }
    })
  ],
  providers: [
    { provide: OverlayContainer, useClass: FullscreenOverlayContainer },
    { provide: HAMMER_GESTURE_CONFIG, useClass: HammerConfig },
    {
      provide: APP_INITIALIZER,
      useFactory: loadFactory,
      deps: [ConfigService, DebugService, AuthnService, AdminService, AccountService, OriginMapService, ThemeService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {
}
