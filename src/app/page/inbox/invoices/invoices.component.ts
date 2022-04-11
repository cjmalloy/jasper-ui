import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.scss']
})
export class InboxInvoicesPage implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    this.page$ = this.search$.pipe(
      mergeMap(search => this.refs.page({
        query: account.inbox + ':plugin/invoice',
        search })),
    );
  }

  ngOnInit(): void {
  }

  get search$() {
    return this.route.queryParams.pipe(
      map(queryParams => queryParams['search'])
    );
  }

}
