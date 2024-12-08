import {
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { defer } from 'lodash-es';
import { Plugin } from '../../model/plugin';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

@Component({
  standalone: false,
  selector: 'app-select-plugin',
  templateUrl: './select-plugin.component.html',
  styleUrls: ['./select-plugin.component.scss']
})
export class SelectPluginComponent implements OnChanges {
  @HostBinding('class') css = 'select-plugin';

  @Input()
  add = false;
  @Input()
  text = false;
  @Input()
  settings = false;
  @Output()
  pluginChange = new EventEmitter<string>();

  @ViewChild('select')
  select?: ElementRef<HTMLSelectElement>;

  submitPlugins = this.admin.submit.filter(p => this.auth.canAddTag(p.tag));
  addPlugins = this.admin.add.filter(p => this.auth.canAddTag(p.tag));
  textPlugins = this.admin.submitText.filter(p => this.auth.canAddTag(p.tag));
  settingsPlugins = this.admin.submitSettings.filter(p => this.auth.canAddTag(p.tag));

  plugins: Plugin[] = [];

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {  }

  ngOnChanges(changes: SimpleChanges) {
    this.plugins = [
      ...(this.add ? this.addPlugins : []),
      ...(this.text ? this.textPlugins : []),
      ...(this.settings ? this.settingsPlugins : []),
      ...this.submitPlugins
    ];
  }

  @Input()
  set plugin(value: string) {
    if (!this.select) {
      if (value) defer(() => this.plugin = value);
    } else {
      if (!this.plugins.find(p => p?.tag === value)) {
        const plugin = this.admin.getPlugin(value);
        if (plugin) {
          this.plugins.unshift(plugin);
          this.select!.nativeElement.selectedIndex = 1;
          return;
        }
      }
      this.select!.nativeElement.selectedIndex = this.plugins.map(p => p.tag).indexOf(value) + 1;
    }
  }

}
