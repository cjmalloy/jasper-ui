import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, Observable, switchMap } from 'rxjs';
import { distinctUntilChanged, tap } from 'rxjs/operators';
import { Ref } from '../../../model/ref';
import { AccountService } from '../../../service/account.service';
import { RefService } from '../../../service/api/ref.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-ref-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss'],
})
export class RefGraphComponent implements OnInit {

  filter$: Observable<string>;
  ref$: Observable<Ref>;

  constructor(
    private theme: ThemeService,
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
      switchMap(url => this.refs.get(url)),
      tap(ref => theme.setTitle('Graph: ' + (ref.title || ref.url))),
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
