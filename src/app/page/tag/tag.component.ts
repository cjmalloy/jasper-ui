import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { RefService } from "../../service/ref.service";
import { mergeMap } from "rxjs/operators";
import { Page } from "../../model/page";
import { Ref } from "../../model/ref";

@Component({
  selector: 'app-tag-page',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagPage implements OnInit {

  tag?: string;
  page?: Page<Ref>;

  constructor(
    private route: ActivatedRoute,
    private refs: RefService,
  ) {
    route.params.pipe(mergeMap(params => this.refs.page(params['tag'])))
    .subscribe(page => this.page = page);
    route.params
    .subscribe(params => this.tag = params['tag']);
  }

  ngOnInit(): void {
  }

}
