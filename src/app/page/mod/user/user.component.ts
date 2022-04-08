import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { User } from '../../../model/user';
import { UserService } from '../../../service/api/user.service';

@Component({
  selector: 'app-mod-user-page',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class ModUserPage implements OnInit {

  page$: Observable<Page<User>>;

  private defaultPageSize = 20;

  constructor(
    private route: ActivatedRoute,
    private users: UserService,
  ) {
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([pageNumber, pageSize]) => {
        return this.users.page({
          page: pageNumber,
          size: pageSize ?? this.defaultPageSize,
        });
      }));
  }

  ngOnInit(): void {
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(params => params['pageNumber']),
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(params => params['pageSize']),
    );
  }
}
