import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { defer } from 'lodash-es';
import { toJS } from 'mobx';
import { Subject, takeUntil } from 'rxjs';
import { Plugin } from '../../model/plugin';
import { active, Icon, ResponseAction, sortOrder, TagAction, Visibility, visible } from '../../model/tag';
import { AdminService } from '../../service/admin.service';
import { emptyObject, getScheme, patchObj, writeObj } from '../../util/http';
import { addAllHierarchicalTags, hasTag } from '../../util/tag';
import { GenFormComponent } from './gen/gen.component';

@Component({
  standalone: false,
  selector: 'app-form-plugins',
  templateUrl: './plugins.component.html',
  styleUrls: ['./plugins.component.scss'],
  host: {'class': 'plugins-form'}
})
export class PluginsFormComponent implements OnChanges, AfterViewInit {
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
  tagForms: Array<{ plugin: Plugin, tag: string, formIndex: number, subTag: string }> = [];

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
    this.tagForms = this.extractTagForms(this.allTags);
    this.icons = sortOrder(this.admin.getIcons(this.allTags, this.plugins.value, getScheme(this.group.value.url))
      .filter(i => !this.forms.find(p => p.tag === i.tag)))
      .filter(i => this.showIcon(i));
  }

  private extractTagForms(tags: string[]): Array<{ plugin: Plugin, tag: string, formIndex: number, subTag: string }> {
    const result: Array<{ plugin: Plugin, tag: string, formIndex: number, subTag: string }> = [];
    const tagFormPlugins = this.admin.getTagForms(tags);
    
    for (const tag of tags) {
      // Find plugins that this tag extends
      const pluginTag = this.findPluginForTag(tag, tagFormPlugins);
      if (!pluginTag) continue;
      
      const plugin = this.admin.getPlugin(pluginTag);
      if (!plugin?.config?.tagForm) continue;
      
      // Extract sub-tags after the plugin tag
      const subTags = this.getSubTags(tag, pluginTag);
      
      // Match sub-tags to tagForm indices
      for (let i = 0; i < subTags.length && i < plugin.config.tagForm.length; i++) {
        if (plugin.config.tagForm[i]) {
          result.push({
            plugin,
            tag,
            formIndex: i,
            subTag: subTags[i]
          });
        }
      }
    }
    return result;
  }

  private findPluginForTag(tag: string, tagFormPlugins: Plugin[]): string | undefined {
    // Remove access prefix
    const cleanTag = tag.replace(/^[_+]/, '');
    const parts = cleanTag.split('/');
    
    // Try to find a plugin that matches this tag or its parents
    for (let i = parts.length; i > 0; i--) {
      const potentialPlugin = parts.slice(0, i).join('/');
      // Check with original access prefix
      const access = tag.startsWith('_') ? '_' : tag.startsWith('+') ? '+' : '';
      const pluginTag = access + potentialPlugin;
      
      if (tagFormPlugins.find(p => p.tag === pluginTag)) {
        return pluginTag;
      }
    }
    return undefined;
  }

  private getSubTags(tag: string, pluginTag: string): string[] {
    // Remove access prefix from both
    const cleanTag = tag.replace(/^[_+]/, '');
    const cleanPluginTag = pluginTag.replace(/^[_+]/, '');
    
    const tagParts = cleanTag.split('/');
    const pluginParts = cleanPluginTag.split('/');
    
    // Return the parts after the plugin tag
    return tagParts.slice(pluginParts.length);
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
    return !this.icons.length && !Object.keys(this.plugins.controls).length && !this.tagForms.length;
  }

  setValue(value: any) {
    value = toJS(value);
    defer(() => {
      this.plugins.patchValue(value);
      this.gens!.forEach(g => g.setValue(value))
    });
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
