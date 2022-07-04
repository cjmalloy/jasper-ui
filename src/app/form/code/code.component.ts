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

  constructor(
    private themes: ThemeService,
  ) { }

  ngOnInit(): void {
  }

  get options() {
    return {
      theme: this.themes.getTheme() === 'dark-theme' ? 'vs-dark' : 'vs',
      language: this.language,
    };
  }

}
