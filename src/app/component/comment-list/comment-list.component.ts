import { Component, Input, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { Page } from "../../model/page";
import { RefService } from "../../service/ref.service";
import { Observable } from "rxjs";

@Component({
  selector: 'app-comment-list',
  templateUrl: './comment-list.component.html',
  styleUrls: ['./comment-list.component.scss']
})
export class CommentListComponent implements OnInit {

  @Input()
  ref!: string;
  @Input()
  depth = 7;
  @Input()
  newComments!: Observable<Ref>;

  pages: Page<Ref>[] = [];

  constructor(
    private refs: RefService,
  ) { }

  get hasMore() {
    if (this.pages.length === 0) return false;
    return this.pages.length < this.pages[0].totalPages;
  }

  ngOnInit(): void {
    this.loadMore();
    this.newComments?.subscribe(comment => this.pages[0].content.unshift(comment));
  }

  loadMore() {
    this.refs.page({
      query: 'plugin/comment@*',
      responses: this.ref,
      page: this.pages.length,
    }).subscribe(page => this.pages.push(page));
  }

}
