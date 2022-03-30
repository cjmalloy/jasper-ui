import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { Page } from "../../model/page";
import { UserService } from "../../service/user.service";
import { mergeMap } from "rxjs/operators";
import { ActivatedRoute, UrlSegment } from "@angular/router";

@Component({
  selector: 'app-home-page',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomePage implements OnInit {

  page?: Page<Ref>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
    private users: UserService,
  ) {
    route.url.subscribe(segments => this.setView(segments[0]));
  }

  ngOnInit(): void {
  }

  setView(view: UrlSegment) {
    if (!view) return;
    if (view.path === "home") {
      this.users
        .getMyUser().pipe(
          mergeMap(user => this.refs.page(user.subscriptions?.join('+'))))
        .subscribe(page => this.page = page);
    } else if (view.path === "all") {
      this.refs.page()
        .subscribe(page => this.page = page);
    }
  }

}
