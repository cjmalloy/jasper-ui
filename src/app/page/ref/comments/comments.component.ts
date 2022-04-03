import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationEnd, Router } from "@angular/router";
import { BehaviorSubject, mergeMap, Subject } from "rxjs";
import { Ref } from "../../../model/ref";
import { filter, switchMap, tap } from "rxjs/operators";
import { RefService } from "../../../service/ref.service";
import { AccountService } from "../../../service/account.service";
import { inboxes } from "../../../plugin/inbox";

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss']
})
export class CommentsComponent implements OnInit {

  inboxes: string[] = [];
  source = new BehaviorSubject<string>(null!);
  depth = 7;
  newComments = new Subject<Ref>();

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    route.queryParams.subscribe(queryParams => this.depth = queryParams['depth'] || this.depth);
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      switchMap(() => route.params),
      tap(params => this.source.next(params['ref'])),
      mergeMap(() => refs.get(this.source.value)),
    ).subscribe(ref => this.inboxes = inboxes(ref, account.tag));
  }

  ngOnInit(): void {
  }
}
