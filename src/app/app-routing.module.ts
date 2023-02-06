import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CreateExtPage } from './page/create/ext/ext.component';
import { CreateUserPage } from './page/create/user/user.component';
import { HomePage } from './page/home/home.component';
import { InboxAllPage } from './page/inbox/all/all.component';
import { InboxPage } from './page/inbox/inbox.component';
import { InboxSentPage } from './page/inbox/sent/sent.component';
import { InboxUnreadPage } from './page/inbox/unread/unread.component';
import { LoginPage } from './page/login/login.component';
import { RefAltsComponent } from './page/ref/alts/alts.component';
import { RefCommentsComponent } from './page/ref/comments/comments.component';
import { RefMissingComponent } from './page/ref/missing/missing.component';
import { RefPage } from './page/ref/ref.component';
import { RefResponsesComponent } from './page/ref/responses/responses.component';
import { RefSourcesComponent } from './page/ref/sources/sources.component';
import { RefSummaryComponent } from './page/ref/summary/summary.component';
import { RefVersionsComponent } from './page/ref/versions/versions.component';
import { SettingsBackupPage } from './page/settings/backup/backup.component';
import { SettingsExtPage } from './page/settings/ext/ext.component';
import { SettingsFeedPage } from './page/settings/feed/feed.component';
import { SettingsOriginPage } from './page/settings/origin/origin.component';
import { SettingsPasswordPage } from './page/settings/password/password.component';
import { SettingsPluginPage } from './page/settings/plugin/plugin.component';
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

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'all', redirectTo: 'tag/@*', pathMatch: 'full' },

  { path: 'login', component: LoginPage },
  { path: 'home', component: HomePage },
  { path: 'tag', redirectTo: 'tag/@*', pathMatch: 'full' },
  { path: 'tag/:tag', component: TagPage },
  { path: 'tag/:tag/edit', component: EditTagPage },
  {
    path: 'ref/:url',
    component: RefPage,
    children: [
      { path: '', component: RefSummaryComponent },
      { path: 'comments', component: RefCommentsComponent },
      { path: 'responses', component: RefResponsesComponent },
      { path: 'sources', component: RefSourcesComponent },
      { path: 'missing', component: RefMissingComponent },
      { path: 'alts', component: RefAltsComponent },
      { path: 'versions', component: RefVersionsComponent },
    ],
  }, {
    path: 'inbox',
    component: InboxPage,
    children: [
      { path: '', redirectTo: 'all', pathMatch: 'full' },
      { path: 'all', component: InboxAllPage },
      { path: 'unread', component: InboxUnreadPage },
      { path: 'sent', component: InboxSentPage },
    ],
  },
  { path: 'submit', component: SubmitPage,
    children: [
      { path: 'web', component: SubmitWebPage },
      { path: 'text', component: SubmitTextPage },
      { path: 'dm', component: SubmitDmPage },
      { path: 'invoice', component: SubmitInvoicePage },
    ]
  },
  { path: 'create/ext', component: CreateExtPage },
  { path: 'create/user', component: CreateUserPage },
  {
    path: 'settings',
    component: SettingsPage,
    children: [
      { path: '', redirectTo: 'user', pathMatch: 'full' },
      { path: 'user', component: SettingsUserPage },
      { path: 'ext', component: SettingsExtPage },
      { path: 'feed', component: SettingsFeedPage },
      { path: 'plugin', component: SettingsPluginPage },
      { path: 'template', component: SettingsTemplatePage },
      { path: 'password', component: SettingsPasswordPage },
      { path: 'setup', component: SettingsSetupPage },
      { path: 'origin', component: SettingsOriginPage },
      { path: 'backup', component: SettingsBackupPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    paramsInheritanceStrategy: 'always',
    onSameUrlNavigation: 'reload',
    enableTracing: false,
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
