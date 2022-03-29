import { Component, Input, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { primaryAuthor } from "../../util/format";

@Component({
  selector: 'app-ref-list-item',
  templateUrl: './ref-list-item.component.html',
  styleUrls: ['./ref-list-item.component.scss']
})
export class RefListItemComponent implements OnInit {

  @Input()
  ref!: Ref;

  constructor() { }

  get submitter() {
    return primaryAuthor(this.ref);
  }

  ngOnInit(): void {
  }

}
