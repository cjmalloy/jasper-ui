import { NgModule } from '@angular/core';
import { DefaultUrlSerializer, RouterModule, Routes, UrlSerializer, UrlTree } from '@angular/router';
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
import { RefMissingComponent } from './page/ref/missing/missing.component';
import { RefPage } from './page/ref/ref.component';
import { RefResponsesComponent } from './page/ref/responses/responses.component';
import { RefSourcesComponent } from './page/ref/sources/sources.component';
import { RefSummaryComponent } from './page/ref/summary/summary.component';
import { RefThreadComponent } from './page/ref/thread/thread.component';
import { RefVersionsComponent } from './page/ref/versions/versions.component';
import { SettingsBackupPage } from './page/settings/backup/backup.component';
import { SettingsExtPage } from './page/settings/ext/ext.component';
import { SettingsOriginsPage } from './page/settings/origins/origins.component';
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

const dus = new DefaultUrlSerializer();
export class CustomUrlSerializer implements UrlSerializer {

  encodeParam(url: string) {
    const parts = new URL('http://test.com/' + url);
    return encodeURIComponent(parts.pathname.substring(1)) + parts.search + parts.hash;
  }

  getExtras(url: string) {
    const parts = new URL('http://test.com/' + url);
    return parts.search + parts.hash;
  }

  parse(url: string) {
    if (url.startsWith('/ref/')) {
      const refChildren = url.match(/\/ref\/\w+\//);
      if (!refChildren?.length) return dus.parse('/ref/' + this.encodeParam(url.substring('/ref/'.length)));
      return dus.parse('/ref/' + refChildren[0] + '/' + this.encodeParam(url.substring('/ref/'.length)));
    }
    if (url.startsWith('/tag/')) {
      return dus.parse('/tag/' + this.encodeParam(url.substring('/tag/'.length)));
    }
    if (url.startsWith('/tags/')) {
      return dus.parse('/tags/' + this.encodeParam(url.substring('/tags/'.length)));
    }
    return dus.parse(url);
  }

  serialize(tree: UrlTree) {
    const url = dus.serialize(tree);
    if (tree.root.children.primary?.segments[0]?.path === 'ref' && tree.root.children.primary?.segments.length === 2) {
      return '/ref/' + tree.root.children.primary?.segments[1].path + this.getExtras(url);
    }
    if (tree.root.children.primary?.segments[0]?.path === 'ref' && tree.root.children.primary?.segments.length === 3) {
      return '/ref/' + tree.root.children.primary.segments[2].path + '/' + tree.root.children.primary.segments[1].path + this.getExtras(url);
    }
    if (tree.root.children.primary?.segments[0]?.path === 'tag') {
      return '/tag/' + tree.root.children.primary.segments[1].path + this.getExtras(url);
    }
    if (tree.root.children.primary?.segments[0]?.path === 'tags' && tree.root.children.primary?.segments.length === 2) {
      return '/tags/' + tree.root.children.primary.segments[1].path + this.getExtras(url);
    }
    return url;
  }
}

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePage },
  { path: 'login', component: LoginPage },
  { path: 'all', redirectTo: 'tag/@*', pathMatch: 'full' },
  { path: 'tag', redirectTo: 'tag/@*', pathMatch: 'full' },
  { path: 'tag/:tag', component: TagPage },
  { path: 'tags', component: TagsPage },
  { path: 'tags/:template', component: TagsPage },
  { path: 'ext', component: ExtPage },
  { path: 'ext/:tag', component: ExtPage },
  { path: 'user', component: UserPage },
  { path: 'user/:tag', component: UserPage },
  {
    path: 'ref/:url',
    component: RefPage,
    children: [
      { path: '', component: RefSummaryComponent },
      { path: 'comments', component: RefCommentsComponent },
      { path: 'thread', component: RefThreadComponent },
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
      { path: 'alarms', component: InboxAlarmsPage },
      { path: 'dms', component: InboxDmsPage },
      { path: 'modlist', component: InboxModlistPage },
    ],
  },
  { path: 'submit', component: SubmitPage,
    children: [
      { path: 'web', component: SubmitWebPage },
      { path: 'text', component: SubmitTextPage },
      { path: 'upload', component: UploadPage },
      { path: 'dm', component: SubmitDmPage },
      { path: 'invoice', component: SubmitInvoicePage },
    ]
  },
  {
    path: 'settings',
    component: SettingsPage,
    children: [
      { path: '', redirectTo: 'user', pathMatch: 'full' },
      { path: 'user', component: SettingsUserPage },
      { path: 'ext', component: SettingsExtPage },
      { path: 'ref', component: SettingsRefPage },
      { path: 'ref/:tag', component: SettingsRefPage },
      { path: 'plugin', component: SettingsPluginPage },
      { path: 'template', component: SettingsTemplatePage },
      { path: 'password', component: SettingsPasswordPage },
      { path: 'setup', component: SettingsSetupPage },
      { path: 'origins', component: SettingsOriginsPage },
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
  providers: [{ provide: UrlSerializer, useClass: CustomUrlSerializer }]
})
export class AppRoutingModule {}
