import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Origin } from '../../model/origin';
import { Page } from '../../model/page';

@Component({
  selector: 'app-origin-list',
  templateUrl: './origin-list.component.html',
  styleUrls: ['./origin-list.component.scss']
})
export class OriginListComponent implements OnInit {
  @HostBinding('class') css = 'origin-list';

  @Input()
  page?: Page<Origin> | null;

  constructor() { }

  ngOnInit(): void {
  }

}
