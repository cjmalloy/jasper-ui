import { Component, ElementRef, EventEmitter, HostBinding, Input, Output, ViewChild } from '@angular/core';
import { defer } from 'lodash-es';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

@Component({
  selector: 'app-select-plugin',
  templateUrl: './select-plugin.component.html',
  styleUrls: ['./select-plugin.component.scss']
})
export class SelectPluginComponent {
  @HostBinding('class') css = 'select-plugin';

  @Input()
  add = false;
  @Output()
  pluginChange = new EventEmitter<string>();

  @ViewChild('select')
  select?: ElementRef<HTMLSelectElement>;

  submitPlugins = this.admin.submit.filter(p => this.auth.canAddTag(p.tag));
  addPlugins = this.admin.add.filter(p => this.auth.canAddTag(p.tag));

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {  }

  @Input()
  set plugin(value: string) {
    if (this.select) {
      this.select!.nativeElement.selectedIndex = this.plugins.map(p => p.tag).indexOf(value) + 1;
    } else {
      defer(() => this.plugin = value);
    }
  }

  get plugins() {
    return this.add ? this.addPlugins : this.submitPlugins;
  }

}
