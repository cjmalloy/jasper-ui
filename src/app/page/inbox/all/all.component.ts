import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/api/ref.service";
import { AccountService } from "../../../service/account.service";
import { Observable } from "rxjs";

@Component({
  selector: 'app-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss']
})
export class AllComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) {
    this.page$ = this.refs.page({ query: account.inbox });
  }

  ngOnInit(): void {
  }

}
