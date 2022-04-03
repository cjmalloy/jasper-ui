import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { filter, mergeMap, switchMap } from "rxjs/operators";

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefPage implements OnInit {

  ref?: Ref;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      switchMap(() => route.firstChild!.params),
      mergeMap(params => refs.get(params['ref']))
    ).subscribe(ref => this.ref = ref);
  }

  ngOnInit(): void {
  }

}
