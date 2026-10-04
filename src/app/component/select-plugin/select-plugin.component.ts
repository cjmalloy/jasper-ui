import { Component, computed, inject, input, model, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { uniqBy } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import { Plugin } from '../../model/plugin';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

@Component({
  selector: 'app-select-plugin',
  templateUrl: './select-plugin.component.html',
  styleUrls: ['./select-plugin.component.scss'],
  host: { 'class': 'select-plugin' },
  imports: [ReactiveFormsModule]
})
export class SelectPluginComponent {
  private admin = inject(AdminService);
  private auth = inject(AuthzService);


  readonly id = input('plugin-' + uuid());
  readonly add = input(false);
  readonly text = input(false);
  readonly settings = input(false);

  /** Pick-and-clear mode: emit `picked` and reset the select instead of updating `plugin`. */
  readonly picker = input(false);

  readonly submitPlugins = computed(() => this.admin.submit().filter(p => this.auth.canAddTag(p.tag)));
  readonly addPlugins = computed(() => this.admin.add().filter(p => this.auth.canAddTag(p.tag)));
  readonly textPlugins = computed(() => this.admin.submitText().filter(p => this.auth.canAddTag(p.tag)));
  readonly settingsPlugins = computed(() => this.admin.submitSettings().filter(p => this.auth.canAddTag(p.tag)));

  readonly plugin = model('');
  readonly picked = output<string>();
  readonly customPlugin = computed(() => this.admin.getPlugin(this.plugin()));
  readonly plugins = computed<Plugin[]>(() => uniqBy([
    ...(this.customPlugin() ? [this.customPlugin()!] : []),
    ...(this.add() ? this.addPlugins() : []),
    ...(this.text() ? this.textPlugins() : []),
    ...(this.settings() ? this.settingsPlugins() : []),
    ...this.submitPlugins()
  ], 'tag'));

  choose(select: HTMLSelectElement) {
    if (this.picker()) {
      this.picked.emit(select.value);
      select.value = '';
    } else {
      this.plugin.set(select.value);
    }
  }

}
