import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { RefService } from "../../../service/ref.service";
import { AccountService } from "../../../service/account.service";

@Component({
  selector: 'app-all',
  templateUrl: './all.component.html',
  styleUrls: ['./all.component.scss']
})
export class AllComponent implements OnInit {

  page?: Page<Ref>;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) {
    this.refs.page({ query: 'plugin/inbox/' + account.tag })
      .subscribe(page => this.page = page);
  }

  ngOnInit(): void {
  }

}
