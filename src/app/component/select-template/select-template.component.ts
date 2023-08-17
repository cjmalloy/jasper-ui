import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { defer } from 'lodash-es';
import { AdminService } from '../../service/admin.service';
import { access } from '../../util/tag';

@Component({
  selector: 'app-select-template',
  templateUrl: './select-template.component.html',
  styleUrls: ['./select-template.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectTemplateComponent {
  @HostBinding('class') css = 'select-template';

  @Output()
  templateChange = new EventEmitter<string>();

  @ViewChild('select')
  select?: ElementRef<HTMLSelectElement>;

  templates = this.admin.tmplSubmit;

  constructor(
    private admin: AdminService,
  ) {  }

  @Input()
  set template(value: string) {
    if (this.select) {
      let hit = this.templates.map(t => t.tag).indexOf(value) + 1;
      if (hit === -1) {
        hit = this.templates.map(t => t.tag).indexOf(value.substring(access(value).length)) + 1;
      }
      this.select!.nativeElement.selectedIndex = hit;
    } else {
      defer(() => this.template = value);
    }
  }

}
