import { Component, ElementRef, HostBinding, Input, OnInit, ViewChild } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { authors, interestingTags, refUrlSummary, webLink } from "../../util/format";
import * as _ from "lodash";
import { mergeMap } from "rxjs";
import { AccountService } from "../../service/account.service";

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefComponent implements OnInit {
  @HostBinding('class') css = 'ref';
  @HostBinding('attr.tabindex') tabIndex = 0;

  expandable = ['plugin/image', 'plugin/video'];

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  showToggle = false;

  @ViewChild('inlineTag')
  inlineTag?: ElementRef;

  commentCount?: number;
  responseCount?: number;
  sourceCount?: number;
  expandPlugin?: string;
  tagging = false;

  constructor(
    private account: AccountService,
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.refs.count({ query: 'plugin/comment@*', responses: this.ref.url }).subscribe(n => this.commentCount = n);
    this.refs.count({ query: '!plugin/comment@*', responses: this.ref.url }).subscribe(n => this.responseCount = n);
    this.refs.count({ sources: this.ref.url }).subscribe(n => this.sourceCount = n);
    if (this.ref.tags) {
      this.expandPlugin = _.intersection(this.ref.tags, this.expandable)[0];
    }
  }

  get authors() {
    return authors(this.ref);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get host() {
    return refUrlSummary(this.ref);
  }

  get webLink() {
    return webLink(this.ref);
  }

  get comments() {
    if (this.commentCount === undefined) return '? comments';
    if (this.commentCount === 0) return 'comment';
    if (this.commentCount === 1) return '1 comment';
    return this.commentCount + ' comments';
  }

  get responses() {
    if (this.responseCount === undefined) return '? citations';
    if (this.responseCount === 0) return 'uncited';
    if (this.responseCount === 1) return '1 citation';
    return this.responseCount + ' citations';
  }

  get sources() {
    if (this.sourceCount === undefined) return '? sources';
    if (this.sourceCount === 0) return 'unsourced';
    if (this.sourceCount === 1) return '1 source';
    return this.sourceCount + ' sources';
  }

  get writeAccess() {
    return this.account.writeAccess(this.ref);
  }

  addInlineTag() {
    if (!this.inlineTag) return;
    const tag = this.inlineTag.nativeElement.value;
    this.refs.patch(this.ref.url, this.ref.origin!, [{
      op: 'add',
      path: '/tags/-',
      value: tag,
    }]).pipe(
      mergeMap(() => this.refs.get(this.ref.url, this.ref.origin!)),
    ).subscribe(ref => {
      this.tagging = false;
      this.ref = ref;
    });
  }
}
