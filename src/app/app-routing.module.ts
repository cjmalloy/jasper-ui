import { Location } from '@angular/common';
import { NgModule } from '@angular/core';
import { DefaultUrlSerializer, RouterModule, Routes, UrlSerializer, UrlTree } from '@angular/router';
import { pendingChangesGuard } from './guard/pending-changes.guard';
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
import { SettingsMePage } from './page/settings/me/me.component';
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

  encodeTagParam(url: string) {
    const parts = new URL('http://test.com/' + url);
    let path = parts.pathname.substring(1);
    path = path.replace(/%7C/g, '|');
    path = encodeURIComponent(path)
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29');
    return path + parts.search + parts.hash;
  }

  stripParam(url: string) {
    const parts = new URL('http://test.com/' + url);
    return parts.pathname.substring(1);
  }

  getExtras(url: string) {
    const parts = new URL('http://test.com/' + url);
    return parts.search + parts.hash;
  }

  parse(url: string) {
    if (url.startsWith('/ref/')) {
      const refChildren = url.match(/^\/ref\/(\w\w+)\//);
      if (!refChildren?.length) {
        if (!/^\/ref\/e\//.test(url)) {
          return dus.parse('/ref/' + encodeURIComponent(url.substring('/ref/'.length)));
        } else {
          return dus.parse('/ref/' + this.stripParam(url.substring('/ref/e/'.length)) + this.getExtras(url));
        }
      }
      if (!/\/ref\/\w\w+\/e\//.test(url)) {
        return dus.parse('/ref/' + encodeURIComponent(url.substring('/ref/'.length + refChildren[1].length + 1)) + '/' + refChildren[1]);
      } else {
        return dus.parse('/ref/' + this.stripParam(url.substring('/ref/e/'.length + refChildren[1].length + 1)) + '/' + refChildren[1] + this.getExtras(url));
      }
    }
    for (const page of ['/tag/', '/tags/', '/ext/', '/user/', '/settings/ref/']) {
      if (url.startsWith(page)) {
        return dus.parse(page + this.encodeTagParam(url.substring(page.length)));
      }
    }
    return dus.parse(url);
  }

  serialize(tree: UrlTree) {
    const url = dus.serialize(tree);
    if (tree.root.children.primary?.segments[0]?.path === 'ref' && tree.root.children.primary.segments.length === 2) {
      if (!this.getExtras(url)) {
        return '/ref/' + tree.root.children.primary.segments[1].path;
      } else {
        return '/ref/e/' + encodeURIComponent(tree.root.children.primary.segments[1].path) + this.getExtras(url);
      }
    }
    if (tree.root.children.primary?.segments[0]?.path === 'ref' && tree.root.children.primary.segments.length === 3) {
      if (!this.getExtras(url)) {
        return '/ref/' + tree.root.children.primary.segments[2].path + '/' + tree.root.children.primary.segments[1].path;
      } else {
        return '/ref/' + tree.root.children.primary.segments[2].path + '/e/' + encodeURIComponent(tree.root.children.primary.segments[1].path) + this.getExtras(url);
      }
    }
    for (let page of ['tag', 'tags', 'ext', 'user', 'settings/ref']) {
      const parts = (page.match(/\//g)?.length || 0) + 1;
      if ((tree.root.children.primary?.segments?.length || 0) <= parts) continue;
      const path = tree.root.children.primary.segments.slice(0, parts).map(s => s.path).join('/');
      if (path === page) {
        return `/${page}/` + tree.root.children.primary.segments[parts].path + this.getExtras(url);
      }
    }
    return url;
  }
}


function _stripBasePath(basePath: string, url: string) {
  if (!basePath || !url.startsWith(basePath)) {
    return url;
  }
  const strippedUrl = url.substring(basePath.length);
  if (strippedUrl === '' || ['/', ';', '?', '#'].includes(strippedUrl[0])) {
    return strippedUrl;
  }
  return url;
}

const _normalize = Location.prototype.normalize;
Location.prototype.normalize = function(url) {
  const norm = _normalize.call(this, url);
  // @ts-ignore
  if (norm.startsWith('/ref/') && !/\/ref(\/\w\w+)?\/e\//.test(url)) return _stripBasePath(this._basePath, url);
  return norm;
};

const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomePage, canDeactivate: [pendingChangesGuard] },
  { path: 'login', component: LoginPage },
  { path: 'all', redirectTo: 'tag/@*', pathMatch: 'full' },
  { path: 'tag', redirectTo: 'tag/@*', pathMatch: 'full' },
  { path: 'tag/:tag', component: TagPage, canDeactivate: [pendingChangesGuard] },
  { path: 'tags', component: TagsPage, canDeactivate: [pendingChangesGuard] },
  { path: 'tags/:template', component: TagsPage, canDeactivate: [pendingChangesGuard] },
  { path: 'ext', component: ExtPage },
  { path: 'ext/:tag', component: ExtPage, canDeactivate: [pendingChangesGuard] },
  { path: 'user', component: UserPage },
  { path: 'user/:tag', component: UserPage, canDeactivate: [pendingChangesGuard] },
  {
    path: 'ref/:url',
    component: RefPage,
    children: [
      { path: '', component: RefSummaryComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'comments', component: RefCommentsComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'thread', component: RefThreadComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'responses', component: RefResponsesComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'sources', component: RefSourcesComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'missing', component: RefMissingComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'alts', component: RefAltsComponent, canDeactivate: [pendingChangesGuard] },
      { path: 'versions', component: RefVersionsComponent, canDeactivate: [pendingChangesGuard] },
    ],
  }, {
    path: 'inbox',
    component: InboxPage,
    children: [
      { path: '', redirectTo: 'all', pathMatch: 'full' },
      { path: 'all', component: InboxAllPage, canDeactivate: [pendingChangesGuard] },
      { path: 'unread', component: InboxUnreadPage, canDeactivate: [pendingChangesGuard] },
      { path: 'sent', component: InboxSentPage, canDeactivate: [pendingChangesGuard] },
      { path: 'alarms', component: InboxAlarmsPage, canDeactivate: [pendingChangesGuard] },
      { path: 'dms', component: InboxDmsPage, canDeactivate: [pendingChangesGuard] },
      { path: 'modlist', component: InboxModlistPage, canDeactivate: [pendingChangesGuard] },
    ],
  },
  { path: 'submit', component: SubmitPage,
    children: [
      { path: 'web', component: SubmitWebPage, canDeactivate: [pendingChangesGuard] },
      { path: 'text', component: SubmitTextPage, canDeactivate: [pendingChangesGuard] },
      { path: 'upload', component: UploadPage, canDeactivate: [pendingChangesGuard] },
      { path: 'dm', component: SubmitDmPage, canDeactivate: [pendingChangesGuard] },
      { path: 'invoice', component: SubmitInvoicePage, canDeactivate: [pendingChangesGuard] },
    ]
  },
  {
    path: 'settings',
    component: SettingsPage,
    children: [
      { path: '', redirectTo: 'me', pathMatch: 'full' },
      { path: 'me', component: SettingsMePage, canDeactivate: [pendingChangesGuard] },
      { path: 'user', component: SettingsUserPage, canDeactivate: [pendingChangesGuard] },
      { path: 'ext', component: SettingsExtPage, canDeactivate: [pendingChangesGuard] },
      { path: 'ref/:tag', component: SettingsRefPage, canDeactivate: [pendingChangesGuard] },
      { path: 'plugin', component: SettingsPluginPage, canDeactivate: [pendingChangesGuard] },
      { path: 'template', component: SettingsTemplatePage, canDeactivate: [pendingChangesGuard] },
      { path: 'password', component: SettingsPasswordPage },
      { path: 'setup', component: SettingsSetupPage, canDeactivate: [pendingChangesGuard] },
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
