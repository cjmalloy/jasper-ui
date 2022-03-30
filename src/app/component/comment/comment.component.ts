import { Component, HostBinding, Input, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { authors, interestingTags } from "../../util/format";
import { Page } from "../../model/page";

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

  children?: Page<Ref>;
  childrenCount = 0;
  responseCount = 0;
  sourceCount = 0;
  collapsed = false;

  constructor(
    private refs: RefService,
  ) { }

  ngOnInit(): void {
    this.refs.countResponses(this.ref.url, 'plugin/comment').subscribe(n => this.childrenCount = n);
    this.refs.countResponses(this.ref.url).subscribe(n => this.responseCount = n);
    this.refs.countSources(this.ref.url).subscribe(n => this.sourceCount = n);
    if (this.depth > 0) {
      this.refs.getResponses(this.ref.url, 'plugin/comment').subscribe(page => this.children = page);
    }
  }

  get authors() {
    return authors(this.ref);
  }

  get tags() {
    return interestingTags(this.ref.tags);
  }

  watch() {
    window.alert('watch')
  }

  tag() {
    window.alert('tag')
  }

  reply() {
    window.alert('reply')
  }

}
