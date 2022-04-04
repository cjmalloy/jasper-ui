import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: 'app-web',
  templateUrl: './web.component.html',
  styleUrls: ['./web.component.scss']
})
export class WebComponent implements OnInit {

  url!: string;

  constructor(
    private route: ActivatedRoute,
  ) {
    route.queryParams.subscribe(params => this.url = params['url']);
  }

  ngOnInit(): void {
  }

}
