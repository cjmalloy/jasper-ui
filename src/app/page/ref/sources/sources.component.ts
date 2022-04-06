import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { ActivatedRoute } from "@angular/router";
import { RefService } from "../../../service/ref.service";
import { mergeMap } from "rxjs/operators";
import { map, Observable } from "rxjs";

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss']
})
export class SourcesComponent implements OnInit {

  page$: Observable<Page<Ref>>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.page$ = this.url$.pipe(
      mergeMap(url => refs.page({ sources: url }))
    );
  }

  ngOnInit(): void {
  }

  get url$() {
    return this.route.params.pipe(map(params => params['ref']));
  }

}
