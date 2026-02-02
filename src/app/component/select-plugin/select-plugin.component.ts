import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Input,
  input,
  OnChanges,
  output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { defer, uniqBy } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { Plugin } from '../../model/plugin';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-select-plugin',
  templateUrl: './select-plugin.component.html',
  styleUrls: ['./select-plugin.component.scss'],
  host: { 'class': 'select-plugin' },
  imports: [ReactiveFormsModule]
})
export class SelectPluginComponent implements OnChanges {
  private admin = inject(AdminService);
  private auth = inject(AuthzService);


  readonly id = input('plugin-' + uuid());
  readonly add = input(false);
  readonly text = input(false);
  readonly settings = input(false);
  readonly pluginChange = output<string>();

  @ViewChild('select')
  select?: ElementRef<HTMLSelectElement>;

  submitPlugins = this.admin.submit.filter(p => this.auth.canAddTag(p.tag));
  addPlugins = this.admin.add.filter(p => this.auth.canAddTag(p.tag));
  textPlugins = this.admin.submitText.filter(p => this.auth.canAddTag(p.tag));
  settingsPlugins = this.admin.submitSettings.filter(p => this.auth.canAddTag(p.tag));

  customPlugin?: Plugin;
  plugins: Plugin[] = [];

  ngOnChanges(changes: SimpleChanges) {
    this.plugins = uniqBy([
      ...(this.customPlugin ? [this.customPlugin] : []),
      ...(this.add() ? this.addPlugins : []),
      ...(this.text() ? this.textPlugins : []),
      ...(this.settings() ? this.settingsPlugins : []),
      ...this.submitPlugins
    ], 'tag');
  }

  @Input()
  set plugin(value: string) {
    if (!this.select) {
      if (value) defer(() => this.plugin = value);
    } else {
      if (!this.plugins.find(p => p?.tag === value)) {
        const plugin = this.admin.getPlugin(value);
        if (plugin) {
          this.customPlugin = plugin;
          this.plugins.unshift(plugin);
          defer(() => this.select!.nativeElement.selectedIndex = 1);
          return;
        }
      }
      this.select!.nativeElement.selectedIndex = this.plugins.map(p => p.tag).indexOf(value) + 1;
    }
  }

}
