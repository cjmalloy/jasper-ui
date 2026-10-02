import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, model, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { defer, uniqBy } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { Plugin } from '../../model/plugin';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

@Component({
  selector: 'app-select-plugin',
  templateUrl: './select-plugin.component.html',
  styleUrls: ['./select-plugin.component.scss'],
  host: { 'class': 'select-plugin' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class SelectPluginComponent {

  readonly id = input('plugin-' + uuid());
  readonly add = input(false);
  readonly text = input(false);
  readonly settings = input(false);

  readonly select = viewChild<ElementRef<HTMLSelectElement>>('select');

  submitPlugins = this.admin.submit.filter(p => this.auth.canAddTag(p.tag));
  addPlugins = this.admin.add.filter(p => this.auth.canAddTag(p.tag));
  textPlugins = this.admin.submitText.filter(p => this.auth.canAddTag(p.tag));
  settingsPlugins = this.admin.submitSettings.filter(p => this.auth.canAddTag(p.tag));

  readonly customPlugin = signal<Plugin | undefined>(undefined);
  readonly plugin = model('');
  readonly plugins = computed(() => uniqBy([
    ...(this.customPlugin() ? [this.customPlugin()] : []),
    ...(this.add() ? this.addPlugins : []),
    ...(this.text() ? this.textPlugins : []),
    ...(this.settings() ? this.settingsPlugins : []),
    ...this.submitPlugins
  ], 'tag'));

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {
    effect(() => this.selectPlugin(this.plugin()));
  }

  private selectPlugin(value: string) {
    const select = this.select();
    if (!select) {
      if (value) defer(() => this.selectPlugin(value));
    } else {
      if (!this.plugins().find(p => p?.tag === value)) {
        const plugin = this.admin.getPlugin(value);
        if (plugin) {
          this.customPlugin.set(plugin);
          defer(() => this.select()!.nativeElement.selectedIndex = 1);
          return;
        }
      }
      select!.nativeElement.selectedIndex = this.plugins().map(p => p.tag).indexOf(value) + 1;
    }
  }

}
