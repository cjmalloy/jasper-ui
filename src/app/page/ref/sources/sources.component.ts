import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { RefService } from '../../../service/api/ref.service';

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss'],
})
export class SourcesComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.page$ = this.url$.pipe(
      mergeMap(url => refs.page({ sources: url })),
    );
  }

  ngOnInit(): void {
  }

  get url$() {
    return this.route.parent!.params.pipe(
      map(params => params['ref']),
    );
  }

}
