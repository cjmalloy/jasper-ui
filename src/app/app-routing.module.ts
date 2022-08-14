import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
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

const routes: Routes = [
  { path: '', redirectTo: 'home/published', pathMatch: 'full' },
  { path: 'all', redirectTo: 'tag/@*/published', pathMatch: 'full' },

  { path: 'login', component: LoginPage },
  { path: 'home', redirectTo: 'home/published', pathMatch: 'full' },
  { path: 'home/:sort', component: HomePage },
  { path: 'tag', redirectTo: 'tag/@*/created', pathMatch: 'full' },
  { path: 'tag/:tag', redirectTo: 'tag/:tag/created', pathMatch: 'full' },
  { path: 'tag/:tag/edit', component: EditTagPage },
  { path: 'tag/:tag/:sort', component: TagPage },
  {
    path: 'ref/:url',
    component: RefPage,
    children: [
      { path: '', redirectTo: 'sources/created', pathMatch: 'full' },
      { path: 'comments', redirectTo: 'comments/created', pathMatch: 'full' },
      { path: 'comments/:sort', component: RefCommentsComponent },
      { path: 'responses', redirectTo: 'responses/created', pathMatch: 'full' },
      { path: 'responses/:sort', component: RefResponsesComponent },
      { path: 'sources', redirectTo: 'sources/created', pathMatch: 'full' },
      { path: 'sources/:sort', component: RefSourcesComponent },
      { path: 'missing', component: RefMissingComponent },
      { path: 'alts', component: RefAltsComponent },
      { path: 'remotes', component: RefRemotesComponent },
      { path: 'graph', component: RefGraphComponent },
    ],
  }, {
    path: 'inbox',
    component: InboxPage,
    children: [
      { path: '', redirectTo: 'all', pathMatch: 'full' },
      { path: 'all', component: InboxAllPage },
      { path: 'unread', component: InboxUnreadPage },
      { path: 'invoices', component: InboxInvoicesPage },
      { path: 'sent', component: InboxSentPage },
    ],
  },
  { path: 'submit', component: SubmitPage },
  { path: 'submit/web', component: SubmitWebPage },
  { path: 'submit/text', component: SubmitTextPage },
  { path: 'submit/dm', component: SubmitDmPage },
  { path: 'submit/invoice', component: SubmitInvoicePage },
  { path: 'create/ext', component: CreateExtPage },
  { path: 'create/user', component: CreateUserPage },
  { path: 'create/profile', component: CreateProfilePage },
  {
    path: 'settings',
    component: SettingsPage,
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      { path: 'user', component: SettingsUserPage },
      { path: 'feed', component: SettingsFeedPage },
      { path: 'ext', component: SettingsExtPage },
      { path: 'plugin', component: SettingsPluginPage },
      { path: 'template', component: SettingsTemplatePage },
      { path: 'profile', component: SettingsProfilePage },
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
