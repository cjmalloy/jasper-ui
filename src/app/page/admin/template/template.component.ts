import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as _ from 'lodash';
import { combineLatest, map, Observable } from 'rxjs';
import { distinctUntilChanged, mergeMap } from 'rxjs/operators';
import { Page } from '../../../model/page';
import { Template } from '../../../model/template';
import { TemplateService } from '../../../service/api/template.service';
import { ThemeService } from '../../../service/theme.service';

@Component({
  selector: 'app-admin-template-page',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss'],
})
export class AdminTemplatePage implements OnInit {

  page$: Observable<Page<Template>>;

  private defaultPageSize = 20;

  constructor(
    private theme: ThemeService,
    private route: ActivatedRoute,
    private templates: TemplateService,
  ) {
    theme.setTitle('Admin: Templates');
    this.page$ = combineLatest(
      this.pageNumber$, this.pageSize$,
    ).pipe(
      distinctUntilChanged(_.isEqual),
      mergeMap(([pageNumber, pageSize]) => {
        return this.templates.page({
          page: pageNumber,
          size: pageSize ?? this.defaultPageSize,
        });
      }));
  }

  ngOnInit(): void {
  }

  get pageNumber$() {
    return this.route.queryParams.pipe(
      map(params => params['pageNumber']),
    );
  }

  get pageSize$() {
    return this.route.queryParams.pipe(
      map(params => params['pageSize']),
    );
  }
}
