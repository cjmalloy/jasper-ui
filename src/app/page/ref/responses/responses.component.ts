import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { ActivatedRoute } from "@angular/router";
import { RefService } from "../../../service/ref.service";
import { mergeMap } from "rxjs/operators";

@Component({
  selector: 'app-responses',
  templateUrl: './responses.component.html',
  styleUrls: ['./responses.component.scss']
})
export class ResponsesComponent implements OnInit {

  page?: Page<Ref>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    route.params
    .pipe(mergeMap(params => refs.getResponses(params['ref'])))
    .subscribe(page => this.page = page);
  }

  ngOnInit(): void {
  }

}
