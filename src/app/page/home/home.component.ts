import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { Page } from "../../model/page";
import { UserService } from "../../service/user.service";
import { mergeMap, switchMap, tap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomePage implements OnInit {

  page?: Page<Ref>;
  path = 'home';

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
    private users: UserService,
  ) {
    route.url.pipe(
      tap(segments => this.path = segments[0].path),
      switchMap(() => route.params)
    ).subscribe(params => this.filter(params['filter']))
  }

  ngOnInit(): void {
  }

  filter(filter: string) {
    if (this.path === "home") {
      if (filter === 'new') {
        this.users.getMyUser().pipe(
          mergeMap(user => this.refs.page({ query: user.subscriptions?.join('+') }))
        ).subscribe(page => this.page = page);
      } else if (filter === 'uncited') {
        this.refs.page({uncited: true }).subscribe(page => this.page = page);
      } else if (filter === 'unsourced') {
        this.refs.page({ unsourced: true }).subscribe(page => this.page = page);
      }
    } else if (this.path === "all") {
      this.refs.page().subscribe(page => this.page = page);
    }
  }

}
