import { controlValue } from '../../util/form';
import { computed, DestroyRef, inject, Component, effect, input, output, viewChildren, untracked, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { defer } from 'lodash-es';
import { TitleDirective } from '../../directive/title.directive';
import { Plugin } from '../../model/plugin';
import { active, Icon, ResponseAction, sortOrder, TagAction, Visibility, visible } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { emptyObject, getScheme, patchObj, writeObj } from '../../util/http';
import { addAllHierarchicalTags, hasTag } from '../../util/tag';
import { GenFormComponent } from './gen/gen.component';

@Component({
  selector: 'app-form-plugins',
  templateUrl: './plugins.component.html',
  styleUrls: ['./plugins.component.scss'],
  host: { 'class': 'plugins-form' },
  imports: [ReactiveFormsModule, TitleDirective, GenFormComponent]
})
export class PluginsFormComponent {
  admin = inject(AdminService);
  private fb = inject(UntypedFormBuilder);

  protected readonly rootControlState = controlValue(() => this.group());

  private readonly controlState0 = controlValue(() => this.tags());

  private destroyRef = inject(DestroyRef);

  readonly gens = viewChildren<GenFormComponent>('gen');

  readonly fieldName = input('plugins');
  readonly groupInput = input<UntypedFormGroup | undefined>(undefined, { alias: 'group' });
  private readonly defaultGroup: UntypedFormGroup;
  readonly togglePlugin = output<string>();

  readonly forms = computed(() => this.admin.getPluginForms(this.allTags()));
  readonly icons = computed(() => {
    this.rootControlState();
    return sortOrder(this.admin.getIcons(this.allTags(), this.plugins()?.value || {}, getScheme(this.group().value.url))
      .filter(icon => !this.forms().find(plugin => plugin.tag === icon.tag)))
      .filter(icon => this.showIcon(icon));
  });
  /**
   * Initial data for plugins about to be added.
   */
  pending: Record<string, any> = {};

  constructor() {
    const admin = this.admin;
    const fb = this.fb;

    this.defaultGroup = fb.group({
      tags: fb.array([]),
      [this.fieldName()]: pluginsForm(fb, admin, []),
    });
    effect(() => {
      this.groupInput();
      this.fieldName();
      untracked(() => this.init());
    });
  }

  init() {
    if (this.plugins()) {
      for (const p in this.plugins().value) {
        if (!this.allTags().includes(p)) {
          this.plugins().removeControl(p);
        }
      }
    }
    if (!this.plugins()) {
      this.group().addControl(this.fieldName(), pluginsForm(this.fb, this.admin, this.allTags()));
    } else if (this.allTags()) {
      for (const t of this.allTags()) {
        if (!this.plugins().contains(t)) {
          const form = pluginForm(this.fb, this.admin, t);
          if (form) {
            this.plugins().addControl(t, form);
          }
        }
      }
    }
  }

  private readonly initializeView = afterNextRender(() => {
    this.tags().valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.init());
  });

  readonly group = computed<UntypedFormGroup>(() => {
    return this.groupInput() || this.defaultGroup;
  });

  readonly tags = computed(() => {
    this.rootControlState();
    return this.group().get('tags') as UntypedFormArray;
  });

  readonly allTags = computed(() => {
    this.rootControlState();
    this.controlState0();
    return addAllHierarchicalTags(this.tags().value);
  });

  readonly plugins = computed(() => {
    this.rootControlState();
    return this.group().get(this.fieldName()) as UntypedFormGroup;
  });

  readonly empty = computed(() => {
    this.rootControlState();
    return !this.icons().length && !Object.keys(this.plugins().controls).length;
  });

  setValue(value: any) {
    defer(() => {
      this.plugins().patchValue(value);
      this.gens()!.forEach(g => g.setValue(value))
    });
  }

  usePending(tag: string) {
    delete this.pending[tag];
  }

  visible(v: Visibility) {
    return visible(this.group().value, v, true, false);
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.group().value, a);
  }

  showIcon(i: Icon) {
    return this.visible(i) && this.active(i);
  }

  hasForm(plugin?: Plugin) {
    if (!plugin) return false;
    if (plugin.config?.submitChild) return false;
    if (plugin.config?.form?.length) return true;
    if (plugin.config?.advancedForm?.length) return true;
    if (this.admin.getPluginSubForms(plugin.tag).length) return true;
    return false;
  }
}

export function pluginsForm(fb: UntypedFormBuilder, admin: AdminService, tags: string[]) {
  return fb.group(tags.reduce((plugins: any, tag: string) => {
    const form = pluginForm(fb, admin, tag);
    if (form) {
      plugins[tag] = form;
    }
    return plugins;
  }, {}));
}

function pluginForm(fb: UntypedFormBuilder, admin: AdminService, tag: string) {
  if (admin.getPlugin(tag)?.config?.form || admin.getPlugin(tag)?.config?.advancedForm) {
    return fb.group({});
  }
  return null;
}

export function writePlugins(tags: string[], plugins: Record<string, any>): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const p in plugins) {
    if (hasTag(p, tags)) result[p] = writeObj(plugins[p]);
  }
  if (emptyObject(result)) return undefined;
  return result;
}

export function patchPlugins(plugins: Record<string, any>): Record<string, any> | undefined {
  const result: Record<string, any> = {};
  for (const p in plugins) {
    result[p] = patchObj(plugins[p]);
  }
  if (emptyObject(result)) return {};
  return result;
}
