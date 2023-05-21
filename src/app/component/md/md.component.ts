import { Component, HostBinding, Input, OnInit } from '@angular/core';
import { debounce, defer } from 'lodash-es';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { AdminService } from '../../service/admin.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-md',
  templateUrl: './md.component.html',
  styleUrls: ['./md.component.scss']
})
export class MdComponent implements OnInit {

  @Input()
  origin? = '';
  @Input()
  plugins?: string[];

  @HostBinding("class.expand")
  get comment() {
    return !this.plugins?.includes('plugin/table');
  }

  postProcessMarkdown: Subject<void> = new Subject();
  private _text = '';
  private _value? = '';

  katexOptions = {
    throwOnError: false,
    delimiters: [
      {left: "$$", right: "$$", display: true},
      {left: "$", right: "$", display: false},
    ],
  };

  constructor(
    public admin: AdminService,
    public store: Store,
  ) { }

  ngOnInit(): void {
  }

  get text(): string {
    return this._text;
  }

  @Input()
  set text(value: string | undefined) {
    this._text = value || '';
    delete this._value;
  }

  get value() {
    if (this._value) return this._value;
    if (this.plugins?.includes('plugin/table')) {
      const wb = XLSX.read(this._text, {type: 'string'});
      return this._value = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]], {header: ''});
    }
    return this._value = this._text;
  }

  onReady() {
    defer(() => this.postProcessMarkdown.next());
  }

}
