import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { ReactiveFormsModule, UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { toJS } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
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
export class PluginsFormComponent implements OnChanges, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChildren('gen')
  gens?: QueryList<GenFormComponent>;

  @Input()
  fieldName = 'plugins';
  @Input()
  group: UntypedFormGroup;
  @Output()
  togglePlugin = new EventEmitter<string>();

  icons: Icon[] = [];
  forms: Plugin[] = [];

  constructor(
    public admin: AdminService,
    private fb: UntypedFormBuilder,
  ) {
    this.group = fb.group({
      tags: fb.array([]),
      [this.fieldName]: pluginsForm(fb, admin, []),
    });
  }

  init() {
    if (this.plugins) {
      for (const p in this.plugins.value) {
        if (!this.allTags.includes(p)) {
          this.plugins.removeControl(p);
        }
      }
    }
    if (!this.plugins) {
      this.group.addControl(this.fieldName, pluginsForm(this.fb, this.admin, this.allTags));
    } else if (this.allTags) {
      for (const t of this.allTags) {
        if (!this.plugins.contains(t)) {
          const form = pluginForm(this.fb, this.admin, t);
          if (form) {
            this.plugins.addControl(t, form);
          }
        }
      }
    }
    this.forms = this.admin.getPluginForms(this.allTags);
    this.icons = sortOrder(this.admin.getIcons(this.allTags, this.plugins.value, getScheme(this.group.value.url))
      .filter(i => !this.forms.find(p => p.tag === i.tag)))
      .filter(i => this.showIcon(i));
  }

  ngAfterViewInit() {
    this.tags.valueChanges.pipe(
      takeUntil(this.destroy$),
    ).subscribe(() => this.init());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.group) {
      this.init();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get tags() {
    return this.group.get('tags') as UntypedFormArray;
  }

  get allTags() {
    return addAllHierarchicalTags(this.tags.value);
  }

  get plugins() {
    return this.group.get(this.fieldName) as UntypedFormGroup;
  }

  get empty() {
    return !this.icons.length && !Object.keys(this.plugins.controls).length;
  }

  /**
   * Set plugin values using reactive form methods.
   * Uses patchValue to update the plugins form group.
   */
  setValue(value: any) {
    if (!value) return;
    value = toJS(value);
    this.plugins.patchValue(value);
    this.gens?.forEach(g => g.setValue(value));
  }

  visible(v: Visibility) {
    return visible(v, true, false);
  }

  active(a: TagAction | ResponseAction | Icon) {
    return active(this.group.value, a);
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
