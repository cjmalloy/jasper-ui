import { Component, OnInit } from "@angular/core";
import { Ref } from "../../model/ref";
import { RefService } from "../../service/ref.service";
import { Page } from "../../model/page";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomePage implements OnInit {

  page!: Page<Ref>;

  constructor(
    ref: RefService,
  ) {
    ref.page()
    .subscribe(value => this.page = value);
  }

  ngOnInit(): void {
  }

}
