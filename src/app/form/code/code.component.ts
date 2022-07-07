import { Component, Input, OnInit } from '@angular/core';
import { FormGroup } from "@angular/forms";
import { ThemeService } from "../../service/theme.service";

@Component({
  selector: 'app-code',
  templateUrl: './code.component.html',
  styleUrls: ['./code.component.scss']
})
export class CodeComponent implements OnInit {

  @Input()
  group!: FormGroup;
  @Input()
  fieldName = 'source';
  @Input()
  language = 'scss';

  options: any = {
    language: 'scss',
  };

  constructor(
    private themes: ThemeService,
  ) {
    this.options.theme = themes.getTheme() === 'dark-theme' ? 'vs-dark' : 'vs';
  }

  ngOnInit(): void {
  }

}
