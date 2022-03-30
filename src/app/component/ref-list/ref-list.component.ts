import { Component, Input, OnInit } from "@angular/core";
import { Page } from "../../model/page";
import { Ref } from "../../model/ref";

@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss']
})
export class RefListComponent implements OnInit {

  @Input()
  page?: Page<Ref>;

  constructor() { }

  ngOnInit(): void {
  }

}
