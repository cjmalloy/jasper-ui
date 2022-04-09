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

const routes: Routes = [
  { path: '', redirectTo: 'home/new', pathMatch: 'full' },
  { path: 'home', redirectTo: 'home/new', pathMatch: 'full' },
  { path: 'all', redirectTo: 'all/new', pathMatch: 'full' },

  { path: 'home/:filter', component: HomePage },
  { path: 'all/:filter', component: HomePage },
  { path: 'tag/:tag', redirectTo: 'tag/:tag/new', pathMatch: 'full' },
  { path: 'tag/:tag/edit', component: EditTagPage },
  { path: 'tag/:tag/:filter', component: TagPage },
  {
    path: 'ref/:ref',
    component: RefPage,
    children: [
      { path: '', redirectTo: 'sources/all', pathMatch: 'full' },
      { path: 'comments', redirectTo: 'comments/all', pathMatch: 'full' },
      { path: 'comments/:filter', component: CommentsComponent },
      { path: 'responses', redirectTo: 'responses/all', pathMatch: 'full' },
      { path: 'responses/:filter', component: ResponsesComponent },
      { path: 'sources', redirectTo: 'sources/all', pathMatch: 'full' },
      { path: 'sources/:filter', component: SourcesComponent },
      { path: 'graph', component: GraphComponent },
    ],
  }, {
    path: 'inbox',
    component: InboxPage,
    children: [
      { path: '', redirectTo: 'all', pathMatch: 'full' },
      { path: 'all', component: AllComponent },
      { path: 'unread', component: UnreadComponent },
    ],
  },
  { path: 'submit', component: SubmitPage },
  { path: 'submit/web', component: SubmitWebPage },
  { path: 'submit/text', component: SubmitTextPage },
  { path: 'submit/feed', component: SubmitFeedPage },
  { path: 'create/ext', component: CreateExtPage },
  { path: 'create/user', component: CreateUserPage },
  { path: 'admin', redirectTo: 'admin/setup', pathMatch: 'full' },
  {
    path: 'admin',
    component: AdminPage,
    children: [
      { path: 'setup', component: AdminSetupPage },
      { path: 'origin', component: AdminOriginPage },
      { path: 'plugin', component: AdminPluginPage },
      { path: 'template', component: AdminTemplatePage },
    ],
  },
  { path: 'settings', redirectTo: 'settings/feed', pathMatch: 'full' },
  {
    path: 'settings',
    component: SettingsPage,
    children: [
      { path: 'feed', component: SettingsFeedPage },
      { path: 'user', component: SettingsUserPage },
      { path: 'ext', component: SettingsExtPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    paramsInheritanceStrategy: 'always',
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
