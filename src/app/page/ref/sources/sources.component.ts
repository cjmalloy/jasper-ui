import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { ActivatedRoute } from "@angular/router";
import { RefService } from "../../../service/ref.service";
import { mergeMap } from "rxjs/operators";

@Component({
  selector: 'app-sources',
  templateUrl: './sources.component.html',
  styleUrls: ['./sources.component.scss']
})
export class SourcesComponent implements OnInit {

  page?: Page<Ref>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    route.params
    .pipe(mergeMap(params => refs.getSources(params['ref'])))
    .subscribe(page => this.page = page);
  }

  ngOnInit(): void {
  }

}
