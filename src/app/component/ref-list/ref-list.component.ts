import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';

@Component({
  selector: 'app-ref-list',
  templateUrl: './ref-list.component.html',
  styleUrls: ['./ref-list.component.scss'],
})
export class RefListComponent implements OnInit {
  @HostBinding('class') css = 'ref-list';

  @Input()
  page?: Page<Ref> | null;
  @Input()
  pinned?: Ref[] | null;
  @Input()
  tag?: string | null;
  @Input()
  graph = false;

  constructor() { }

  ngOnInit(): void {
  }

}
