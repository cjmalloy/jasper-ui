import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, mergeMap, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss'],
})
export class GraphComponent implements OnInit {

  filter$: Observable<string>;
  ref$: Observable<Ref>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    this.filter$ = this.route.params.pipe(
      map(params => params['filter']),
      distinctUntilChanged(),
    );
    this.ref$ = this.url$.pipe(
      mergeMap(url => this.refs.get(url)),
    );
  }

  ngOnInit(): void {
  }

  get url$() {
    return this.route.params.pipe(
      map(params => params['ref']),
      distinctUntilChanged(),
    );
  }

}
