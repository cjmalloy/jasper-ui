import { DragDropModule } from '@angular/cdk/drag-drop';
import { FullscreenOverlayContainer, OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, isDevMode, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule, HAMMER_GESTURE_CONFIG, HammerModule } from '@angular/platform-browser';
import { ServiceWorkerModule } from '@angular/service-worker';
import { FormlyModule } from '@ngx-formly/core';
import { Settings } from 'luxon';
import { MobxAngularModule } from 'mobx-angular';
import { MarkdownModule } from 'ngx-markdown';
import { MonacoEditorModule } from 'ngx-monaco-editor';
import { retry, switchMap, timer } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { ActionListComponent } from './component/action/action-list/action-list.component';
import { ConfirmActionComponent } from './component/action/confirm-action/confirm-action.component';
import { InlineButtonComponent } from './component/action/inline-button/inline-button.component';
import { InlinePasswordComponent } from './component/action/inline-password/inline-password.component';
import { InlineSelectComponent } from './component/action/inline-select/inline-select.component';
import { InlineTagComponent } from './component/action/inline-tag/inline-tag.component';
import { InlinePluginComponent } from './component/action/inline-plugin/inline-plugin.component';
import { BackgammonComponent } from './component/backgammon/backgammon.component';
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
import { DiffEditorComponent } from './component/diff-editor/diff-editor';
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
import { ModComponent } from './component/mod/mod.component';
import { NavComponent } from './component/nav/nav.component';
import { NoteComponent } from './component/notebook/note/note.component';
import { NotebookComponent } from './component/notebook/notebook.component';
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
import { TabsComponent } from './component/tabs/tabs.component';
import { TemplateListComponent } from './component/template/template-list/template-list.component';
import { TemplateComponent } from './component/template/template.component';
import { TodoItemComponent } from './component/todo/item/item.component';
import { TodoComponent } from './component/todo/todo.component';
import { UserListComponent } from './component/user/user-list/user-list.component';
import { UserComponent } from './component/user/user.component';
import { UserTagSelectorComponent } from './component/user-tag-selector/user-tag-selector.component';
import { ViewerComponent } from './component/viewer/viewer.component';
import { AutofocusDirective } from './directive/autofocus.directive';
import { FillWidthDirective } from './directive/fill-width.directive';
import { ImageDirective } from './directive/image.directive';
import { InputDoneDirective } from './directive/input-done.directive';
import { LimitWidthDirective } from './directive/limit-width.directive';
import { MdPostDirective } from './directive/md-post.directive';
import { ResizeHandleDirective } from './directive/resize-handle.directive';
import { ResizeDirective } from './directive/resize.directive';
import { RouterActivateDirective } from './directive/router-activate.directive';
import { TitleDirective } from './directive/title.directive';
import { CodeComponent } from './form/code/code.component';
import { EditorComponent } from './form/editor/editor.component';
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
import { AuthInterceptor } from './http/auth.interceptor';
import { CsrfInterceptor } from './http/csrf.interceptor';
import { RateLimitInterceptor } from './http/rate-limit.interceptor';
import { ExtPage } from './page/ext/ext.component';
import { HomePage } from './page/home/home.component';
import { InboxAlarmsPage } from './page/inbox/alarms/alarms.component';
import { InboxAllPage } from './page/inbox/all/all.component';
import { InboxDmsPage } from './page/inbox/dms/dms.component';
import { InboxPage } from './page/inbox/inbox.component';
import { InboxModlistPage } from './page/inbox/modlist/modlist.component';
import { InboxRefPage } from './page/inbox/ref/ref.component';
import { InboxReportsPage } from './page/inbox/reports/reports.component';
import { InboxSentPage } from './page/inbox/sent/sent.component';
import { InboxUnreadPage } from './page/inbox/unread/unread.component';
import { LoginPage } from './page/login/login.component';
import { RefAltsComponent } from './page/ref/alts/alts.component';
import { RefCommentsComponent } from './page/ref/comments/comments.component';
import { RefErrorsComponent } from './page/ref/errors/errors.component';
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
import { CssUrlPipe } from './pipe/css-url.pipe';
import { SafePipe } from './pipe/safe.pipe';
import { TagPreviewPipe } from './pipe/tag-preview.pipe';
import { ThumbnailPipe } from './pipe/thumbnail.pipe';
import { AccountService } from './service/account.service';
import { AdminService } from './service/admin.service';
import { ExtService } from './service/api/ext.service';
import { ConfigService } from './service/config.service';
import { DebugService } from './service/debug.service';
import { ModService } from './service/mod.service';
import { OriginMapService } from './service/origin-map.service';

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
    RefThreadComponent,
    RefErrorsComponent,
    RefResponsesComponent,
    RefSourcesComponent,
    RefAltsComponent,
    RefVersionsComponent,
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
    InboxRefPage,
    SearchComponent,
    EditorComponent,
    ViewerComponent,
    SafePipe,
    ThumbnailPipe,
    CssUrlPipe,
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
    KanbanComponent,
    KanbanColumnComponent,
    KanbanCardComponent,
    NotebookComponent,
    NoteComponent,
    MdComponent,
    ModComponent,
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
    GenFormComponent,
    SortComponent,
    FilterComponent,
    QueryComponent,
    BulkComponent,
    QrComponent,
    DebugComponent,
    FillWidthDirective,
    LimitWidthDirective,
    SelectTemplateComponent,
    FolderComponent,
    SubfolderComponent,
    FileComponent,
    RouterActivateDirective,
    SelectPluginComponent,
    ImageDirective,
    ResizeHandleDirective,
    PluginListComponent,
    TemplateListComponent,
    CommentThreadComponent,
    InboxDmsPage,
    UploadPage,
    InboxModlistPage,
    InboxReportsPage,
    ChessComponent,
    TagsPage,
    TagPreviewPipe,
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
    ConfirmActionComponent,
    ActionListComponent,
    DiffEditorComponent,
    InlineTagComponent,
    InlinePluginComponent,
    InlinePasswordComponent,
    InlineSelectComponent,
    InlineButtonComponent,
    TabsComponent,
    UserTagSelectorComponent,
  ],
  imports: [
    BrowserModule,
    HammerModule,
    AppRoutingModule,
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
    ServiceWorkerModule.register('ngsw-worker.js', {
      scope: '.',
      enabled: !isDevMode() && location.hostname != 'localhost',
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
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
  ],
  bootstrap: [AppComponent],
})
export class AppModule { }
