import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormGroup } from "@angular/forms";
import { ThemeService } from "../../service/theme.service";

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
    private themes: ThemeService,
  ) {
    this.options.theme = themes.getTheme() === 'dark-theme' ? 'vs-dark' : 'vs';
  }

  @Input()
  set language(value: string) {
     this.options.language = value;
  }

  ngOnInit(): void {
  }

}
