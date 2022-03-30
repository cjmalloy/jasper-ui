import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { HomePage } from "./page/home/home.component";
import { TagPage } from "./page/tag/tag.component";
import { RefPage } from "./page/ref/ref.component";
import { CommentsComponent } from "./page/ref/comments/comments.component";
import { ResponsesComponent } from "./page/ref/responses/responses.component";
import { SourcesComponent } from "./page/ref/sources/sources.component";
import { GraphComponent } from "./page/ref/graph/graph.component";

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },

  { path: 'home', component: HomePage },
  { path: 'all', component: HomePage },
  { path: 'tag/:sort/:tag', component: TagPage },
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
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
