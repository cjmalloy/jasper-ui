import { Component, Input, OnInit } from '@angular/core';
import { Ref } from '../../model/ref';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss']
})
export class ChartComponent implements OnInit {

  private _ref?: Ref;

  ngOnInit(): void {
  }

  get ref() {
    return this._ref;
  }

  @Input()
  set ret(value: Ref) {
    this._ref = value;
  }
}
