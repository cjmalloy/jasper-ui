import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { ActivatedRoute, Router } from "@angular/router";
import { distinctUntilChanged, mergeMap } from "rxjs/operators";
import { map, Observable } from "rxjs";

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefPage implements OnInit {

  ref$: Observable<Ref>;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    this.ref$ = this.url$.pipe(
      distinctUntilChanged(),
      mergeMap(url => refs.get(url)),
    );
  }

  ngOnInit(): void {
  }

  get url$() {
    return this.route.firstChild!.params.pipe(map((params) => params['ref']));
  }

}
