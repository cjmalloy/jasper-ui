import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminPage } from './page/admin/admin.component';
import { AdminOriginPage } from './page/admin/origin/origin.component';
import { AdminPluginPage } from './page/admin/plugin/plugin.component';
import { AdminSetupPage } from './page/admin/setup/setup.component';
import { AdminTemplatePage } from './page/admin/template/template.component';
import { CreateExtPage } from './page/create/ext/ext.component';
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

const routes: Routes = [
  { path: '', redirectTo: 'home/created', pathMatch: 'full' },
  { path: 'all', redirectTo: 'tag/@*/published', pathMatch: 'full' },

  { path: 'login', component: LoginPage },
  { path: 'home', redirectTo: 'home/created', pathMatch: 'full' },
  { path: 'home/:sort', component: HomePage },
  { path: 'tag', redirectTo: 'tag/@*/created', pathMatch: 'full' },
  { path: 'tag/:tag', redirectTo: 'tag/:tag/created', pathMatch: 'full' },
  { path: 'tag/:tag/edit', component: EditTagPage },
  { path: 'tag/:tag/:sort', component: TagPage },
  {
    path: 'ref/:ref',
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
  { path: 'submit/feed', component: SubmitFeedPage },
  { path: 'submit/dm', component: SubmitDmPage },
  { path: 'submit/invoice', component: SubmitInvoicePage },
  { path: 'create/ext', component: CreateExtPage },
  { path: 'create/user', component: CreateUserPage },
  {
    path: 'admin',
    component: AdminPage,
    children: [
      { path: '', redirectTo: 'setup', pathMatch: 'full' },
      { path: 'setup', component: AdminSetupPage },
      { path: 'origin', component: AdminOriginPage },
      { path: 'plugin', component: AdminPluginPage },
      { path: 'template', component: AdminTemplatePage },
    ],
  },
  {
    path: 'settings',
    component: SettingsPage,
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },
      { path: 'feed', component: SettingsFeedPage },
      { path: 'user', component: SettingsUserPage },
      { path: 'ext', component: SettingsExtPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    paramsInheritanceStrategy: 'always',
    enableTracing: false,
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
