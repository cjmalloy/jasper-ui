import { Component, OnInit } from "@angular/core";
import { Page } from "../../../model/page";
import { Ref } from "../../../model/ref";
import { ActivatedRoute } from "@angular/router";
import { RefService } from "../../../service/ref.service";
import { mergeMap } from "rxjs/operators";

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss']
})
export class CommentsComponent implements OnInit {

  page?: Page<Ref>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    route.params
      .pipe(mergeMap(params => refs.getResponses(params['ref'], 'plugin/comment')))
      .subscribe(page => this.page = page);
  }

  ngOnInit(): void {
  }
}
