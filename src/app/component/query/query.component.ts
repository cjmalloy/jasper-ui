import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { breadcrumbs } from '../../util/tag';

@Component({
  selector: 'app-query',
  templateUrl: './query.component.html',
  styleUrls: ['./query.component.scss']
})
export class QueryComponent implements OnInit {


  @Input()
  query = '';

  editing = false;

  constructor(
    private router: Router,
  ) { }

  ngOnInit(): void {
  }

  get breadcrumbs() {
    return breadcrumbs(this.query);
  }

  search(query: string) {
    this.editing = false;
    this.router.navigate(['/tag', query], { queryParams: { pageNumber: null },  queryParamsHandling: 'merge'});
  }

}
