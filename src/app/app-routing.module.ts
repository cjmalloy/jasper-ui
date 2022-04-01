import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { HomePage } from "./page/home/home.component";
import { TagPage } from "./page/tag/tag.component";
import { RefPage } from "./page/ref/ref.component";
import { CommentsComponent } from "./page/ref/comments/comments.component";
import { ResponsesComponent } from "./page/ref/responses/responses.component";
import { SourcesComponent } from "./page/ref/sources/sources.component";
import { GraphComponent } from "./page/ref/graph/graph.component";
import { InboxPage } from "./page/inbox/inbox.component";
import { AllComponent } from "./page/inbox/all/all.component";
import { UnreadComponent } from "./page/inbox/unread/unread.component";

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', redirectTo: '/home/new', pathMatch: 'full' },
  { path: 'all', redirectTo: '/all/new', pathMatch: 'full' },

  { path: 'home/:filter', component: HomePage },
  { path: 'all/:filter', component: HomePage },
  { path: 'tag/:tag', redirectTo: '/tag/:tag/new', pathMatch: 'full' },
  { path: 'tag/:tag/:filter', component: TagPage },
  {
    path: 'ref',
    component: RefPage,
    children: [
      { path: '', redirectTo: 'comments', pathMatch: 'full' },
      { path: 'comments/:ref', component: CommentsComponent },
      { path: 'responses/:ref', component: ResponsesComponent },
      { path: 'sources/:ref', component: SourcesComponent },
      { path: 'graph/:ref', component: GraphComponent },
    ]
  },
  {
    path: 'inbox',
    component: InboxPage,
    children: [
      { path: '', redirectTo: 'all', pathMatch: 'full' },
      { path: 'all', component: AllComponent },
      { path: 'unread', component: UnreadComponent },
    ]
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
