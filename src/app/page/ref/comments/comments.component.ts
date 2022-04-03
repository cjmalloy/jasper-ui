import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { BehaviorSubject, Subject } from "rxjs";
import { Ref } from "../../../model/ref";
import { filter, switchMap } from "rxjs/operators";

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss']
})
export class CommentsComponent implements OnInit {

  source = new BehaviorSubject<string>(null!);
  depth = 7;
  newComments = new Subject<Ref>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    route.queryParams.subscribe(queryParams => this.depth = queryParams['depth'] || this.depth);
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      switchMap(() => route.params),
    ).subscribe(params => this.source.next(params['ref']));
  }

  ngOnInit(): void {
  }
}
