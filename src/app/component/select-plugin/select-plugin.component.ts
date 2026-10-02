import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, model, signal, untracked, viewChild } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule]
})
export class SelectPluginComponent {

  readonly id = input('plugin-' + uuid());
  readonly add = input(false);
  readonly text = input(false);
  readonly settings = input(false);

  readonly select = viewChild<ElementRef<HTMLSelectElement>>('select');

  readonly submitPlugins = computed(() => this.admin.submit().filter(p => this.auth.canAddTag(p.tag)));
  readonly addPlugins = computed(() => this.admin.add().filter(p => this.auth.canAddTag(p.tag)));
  readonly textPlugins = computed(() => this.admin.submitText().filter(p => this.auth.canAddTag(p.tag)));
  readonly settingsPlugins = computed(() => this.admin.submitSettings().filter(p => this.auth.canAddTag(p.tag)));

  readonly customPlugin = computed(() => this.admin.getPlugin(this.plugin()));
  readonly plugin = model('');
  readonly plugins = computed<Plugin[]>(() => uniqBy([
    ...(this.customPlugin() ? [this.customPlugin()!] : []),
    ...(this.add() ? this.addPlugins() : []),
    ...(this.text() ? this.textPlugins() : []),
    ...(this.settings() ? this.settingsPlugins() : []),
    ...this.submitPlugins()
  ], 'tag'));

  constructor(
    private admin: AdminService,
    private auth: AuthzService,
  ) {
    effect(() => {
      const plugin = this.plugin();
      this.plugins();
      this.select();
      untracked(() => this.selectPlugin(plugin));
    });
  }

  private selectPlugin(value: string) {
    const select = this.select();
    if (select) select.nativeElement.selectedIndex = this.plugins().map(p => p.tag).indexOf(value) + 1;
  }

}
