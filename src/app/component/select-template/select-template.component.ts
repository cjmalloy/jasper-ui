import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { AdminService } from '../../service/admin.service';

@Component({
  selector: 'app-select-template',
  templateUrl: './select-template.component.html',
  styleUrls: ['./select-template.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectTemplateComponent {

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
      this.select!.nativeElement.selectedIndex = this.templates.map(t => t.tag + '/').indexOf(value) + 1;
    }
  }

}
