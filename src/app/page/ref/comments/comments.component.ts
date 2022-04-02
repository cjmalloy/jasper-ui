import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { RefService } from "../../../service/ref.service";
import { v4 as uuid } from "uuid";
import { AccountService } from "../../../service/account.service";
import * as moment from "moment";
import { mergeMap, Subject } from "rxjs";
import { Ref } from "../../../model/ref";

@Component({
  selector: 'app-comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss']
})
export class CommentsComponent implements OnInit {

  ref?: string;
  depth = 7;
  newComments = new Subject<Ref>();

  @ViewChild('textbox')
  textbox!: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private account: AccountService,
    private refs: RefService,
  ) {
    route.params.subscribe(params => this.ref = params['ref']);
    route.queryParams.subscribe(queryParams => this.depth = queryParams['depth'] || this.depth);
  }

  ngOnInit(): void {
  }

  reply(value: string) {
    const url = 'comment://' + uuid();
    this.refs.create({
      url,
      sources: [this.ref!],
      comment: value,
      tags: ["public", this.account.tag, "plugin/comment"],
      published: moment(),
    }).pipe(
      mergeMap(() => this.refs.get(url))
    ).subscribe(ref => {
      this.newComments.next(ref);
      this.textbox.nativeElement.value = '';
    });
  }
}
