import { Component, computed, input, output, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';
import { access } from '../../util/tag';

@Component({
  selector: 'app-select-template',
  templateUrl: './select-template.component.html',
  styleUrls: ['./select-template.component.scss'],
  host: { 'class': 'select-template' },
  imports: [ReactiveFormsModule]
})
export class SelectTemplateComponent {
  private admin = inject(AdminService);
  private auth = inject(AuthzService);


  readonly templateChange = output<string>();
  readonly template = input('', { alias: 'template' });

  readonly submitTemplates = computed(() => this.admin.tmplSubmit().filter(p => this.auth.canAddTag(p.tag)));

  readonly templates = computed(() => {
    const templates = this.submitTemplates();
    const value = this.template();
    if (templates.some(t => t.tag === value || t.tag === value.substring(access(value).length))) return templates;
    const template = this.admin.getTemplate(value);
    return template ? [template, ...templates] : templates;
  });

  readonly selected = computed(() => {
    const value = this.template();
    const tags = this.templates().map(t => t.tag);
    if (tags.includes(value)) return value;
    const stripped = value.substring(access(value).length);
    return tags.includes(stripped) ? stripped : '';
  });

}
