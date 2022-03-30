import { Component, HostBinding, Input, OnInit } from "@angular/core";
import { Page } from "../../model/page";
import { Ref } from "../../model/ref";

@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss']
})
export class RefListComponent implements OnInit {
  @HostBinding('class') css = 'ref-list';

  @Input()
  page?: Page<Ref>;

  constructor() { }

  ngOnInit(): void {
  }

}
