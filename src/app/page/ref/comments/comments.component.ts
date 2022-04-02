import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss']
})
export class CommentsComponent implements OnInit {

  ref?: string;
  depth = 7;

  constructor(
    private route: ActivatedRoute,
  ) {
    route.params.subscribe(params => this.ref = params['ref']);
    route.queryParams.subscribe(queryParams => this.depth = queryParams['depth'] || this.depth);
  }

  ngOnInit(): void {
  }
}
