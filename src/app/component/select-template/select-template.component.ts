import { ChangeDetectionStrategy, Component, effect, ElementRef, input, output, signal, viewChild, untracked } from '@angular/core';
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

  submitTemplates = this.admin.tmplSubmit.filter(p => this.auth.canAddTag(p.tag));

  readonly templates = signal<Template[]>([...this.submitTemplates], { equal: () => false });

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {
    effect(() => {
      const value = this.template();
      untracked(() => this.selectTemplate(value));
    });
  }

  private selectTemplate(value: string) {
    if (!this.select()) {
      if (value) defer(() => this.selectTemplate(value));
    } else {
      let hit = this.templates().map(t => t.tag).indexOf(value) + 1;
      if (!hit) {
        hit = this.templates().map(t => t.tag).indexOf(value.substring(access(value).length)) + 1;
      }
      if (!hit && value && !this.templates().find(p => (p?.tag) === value)) {
        const template = this.admin.getTemplate(value);
        if (template) {
          this.templates.update(templates => [template, ...templates]);
          defer(() => this.select()!.nativeElement.selectedIndex = 1);
          return;
        }
      }
      defer(() => this.select()!.nativeElement.selectedIndex = hit);
    }
  }

}
