import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, output, viewChild, untracked } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class SelectTemplateComponent {

  readonly templateChange = output<string>();
  readonly template = input('', { alias: 'template' });

  readonly select = viewChild<ElementRef<HTMLSelectElement>>('select');

  readonly submitTemplates = computed(() => this.admin.tmplSubmit().filter(p => this.auth.canAddTag(p.tag)));

  readonly templates = computed(() => {
    const templates = this.submitTemplates();
    const value = this.template();
    if (templates.some(t => t.tag === value || t.tag === value.substring(access(value).length))) return templates;
    const template = this.admin.getTemplate(value);
    return template ? [template, ...templates] : templates;
  });

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {
    effect(() => {
      const value = this.template();
      this.templates();
      this.select();
      untracked(() => this.selectTemplate(value));
    });
  }

  private selectTemplate(value: string) {
    const select = this.select();
    if (select) {
      let hit = this.templates().map(t => t.tag).indexOf(value) + 1;
      if (!hit) {
        hit = this.templates().map(t => t.tag).indexOf(value.substring(access(value).length)) + 1;
      }
      select.nativeElement.selectedIndex = hit;
    }
  }

}
