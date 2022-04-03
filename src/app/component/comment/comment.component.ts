import { Component, HostBinding, Input, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { authors, interestingTags } from "../../util/format";
import { BehaviorSubject, Subject } from "rxjs";

@Component({
  selector: 'app-comment',
  templateUrl: './comment.component.html',
  styleUrls: ['./comment.component.scss']
})
export class CommentComponent implements OnInit {
  @HostBinding('class') css = 'comment';
  @HostBinding('attr.tabindex') tabIndex = 0;

  @Input()
  ref!: Ref;
  @Input()
  depth = 7;

  source = new BehaviorSubject<string>(null!);
  newComments = new Subject<Ref>();
  commentCount?: number;
  responseCount?: number;
  sourceCount?: number;
  collapsed = false;
  reply = false;

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.refs.count({ query: 'plugin/comment@*', responses: this.ref.url }).subscribe(n => this.commentCount = n);
    this.refs.count({ query: '!plugin/comment@*', responses: this.ref.url }).subscribe(n => this.responseCount = n);
    this.refs.count({ query: '!plugin/comment@*', sources: this.ref.url }).subscribe(n => this.sourceCount = n);
    this.newComments.subscribe(() => this.reply = false);
    this.source.next(this.ref.url);
  }

  get authors() {
    return authors(this.ref);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  get comments() {
    if (this.commentCount === undefined) return '(? comments)';
    if (this.commentCount === 1) return '(1 comment)';
    return `(${this.commentCount} comments)`;
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

  watch() {
    window.alert('watch')
  }

  tag() {
    window.alert('tag')
  }

}
