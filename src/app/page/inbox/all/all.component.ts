import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/ref.service";
import { mergeMap } from "rxjs/operators";
import { UserService } from "../../../service/user.service";

@Component({
  selector: 'app-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss']
})
export class AllComponent implements OnInit {

  page?: Page<Ref>;

  constructor(
    private users: UserService,
    private refs: RefService,
  ) {
    users.getMyUser().pipe(mergeMap(user => refs.page({ query: 'plugin/inbox/' + user.tag })))
      .subscribe(page => this.page = page);
  }

  ngOnInit(): void {
  }

}
