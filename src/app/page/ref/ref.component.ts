import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { ActivatedRoute } from "@angular/router";
import { mergeMap } from "rxjs/operators";

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefPage implements OnInit {

  ref!: Ref;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    route.firstChild?.params
      .pipe(mergeMap(params => refs.get(params['ref'])))
      .subscribe(ref => this.ref = ref);
  }

  ngOnInit(): void {
  }

}
