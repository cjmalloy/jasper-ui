import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { ThemeService } from '../../service/theme.service';
import { Store } from '../../store/store';

@Component({
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss']
})
export class CodeComponent implements OnInit {

  @Input()
  group!: UntypedFormGroup;
  @Input()
  fieldName = 'source';

  options: any = {
    language: 'css',
  };

  constructor(
    private store: Store,
  ) {
    this.options.theme = store.darkTheme ? 'vs-dark' : 'vs';
  }

  @Input()
  set language(value: string) {
     this.options.language = value;
  }

  ngOnInit(): void {
  }

}
