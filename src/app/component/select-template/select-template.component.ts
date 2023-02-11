import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-select-template',
  templateUrl: './select-template.component.html',
  styleUrls: ['./select-template.component.scss']
})
export class SelectTemplateComponent {

  @Input()
  template = '';
  @Output()
  templateChange = new EventEmitter<string>();

  templates = this.admin.tmplSubmit;

  constructor(
    private admin: AdminService,
  ) {  }

}
