import { Component, ElementRef, Input, ChangeDetectionStrategy, output, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { defer } from 'lodash-es';
import { Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { access } from '../../util/tag';

@Component({
  selector: 'app-select-template',
  templateUrl: './select-template.component.html',
  styleUrls: ['./select-template.component.scss'],
  host: { 'class': 'select-template' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ReactiveFormsModule]
})
export class SelectTemplateComponent {

  readonly templateChange = output<string>();

  readonly select = viewChild<ElementRef<HTMLSelectElement>>('select');

  submitTemplates = this.admin.tmplSubmit.filter(p => this.auth.canAddTag(p.tag));

  templates: Template[] = [...this.submitTemplates];

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {  }

  @Input()
  set template(value: string) {
    if (!this.select()) {
      if (value) defer(() => this.template = value);
    } else {
      let hit = this.templates.map(t => t.tag).indexOf(value) + 1;
      if (!hit) {
        hit = this.templates.map(t => t.tag).indexOf(value.substring(access(value).length)) + 1;
      }
      if (!hit && value && !this.templates.find(p => (p?.tag) === value)) {
        const template = this.admin.getTemplate(value);
        if (template) {
          this.templates.unshift(template);
          defer(() => this.select()!.nativeElement.selectedIndex = 1);
          return;
        }
      }
      defer(() => this.select()!.nativeElement.selectedIndex = hit);
    }
  }

}
