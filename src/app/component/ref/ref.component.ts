import { Component, Input, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { authors, interestingTags } from "../../util/format";
import * as _ from "lodash";

@Component({
  selector: 'app-ref',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss']
})
export class RefComponent implements OnInit {

  expandable = ['plugin/comment', 'plugin/image', 'plugin/video'];

  @Input()
  ref!: Ref;
  @Input()
  expanded = false;
  @Input()
  showToggle = false;

  commentCount = 0;
  responseCount = 0;
  sourceCount = 0;
  expandPlugin?: string;

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.refs.countResponses(this.ref.url, 'plugin/comment').subscribe(n => this.commentCount = n);
    this.refs.countResponses(this.ref.url).subscribe(n => this.responseCount = n);
    this.refs.countSources(this.ref.url).subscribe(n => this.sourceCount = n);
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
    return new URL(this.ref.url).host;
  }

  watch() {
    window.alert('watch')
  }

  tag() {
    window.alert('tag')
  }
}
