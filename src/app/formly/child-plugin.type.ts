import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FieldType } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../model/plugin';
import { convertFeature } from '../util/geo';
import { directChild, hasPrefix } from '../util/tag';

/**
 * Select a single child plugin of the parent plugin (props.parent).
 * Changing the selection swaps the child plugin tag on the Ref, converting
 * the GeoJSON geometry of the previous child where possible.
 * Children in props.keep stay on the Ref when another child is selected,
 * so a kept child can be combined with one other.
 * Has no key, so nothing is stored in the parent plugin data.
 */
@Component({
  selector: 'formly-field-child-plugin',
  host: { 'class': 'field child-plugin-field' },
  template: `
    <select class="child-plugin-select"
            [id]="id"
            [attr.aria-label]="parentName"
            [disabled]="!togglePlugin"
            (input)="select($any($event.target).value)">
      <option value="" [selected]="!current">{{ parentName }}</option>
      @for (p of visibleChildren; track p.tag) {
        <option [value]="p.tag" [selected]="p.tag === current">{{ p.name || '#' + p.tag }}</option>
      }
    </select>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FormlyFieldChildPlugin extends FieldType {

  get parent(): string {
    return this.props.parent;
  }

  get parentName(): string {
    return this.formState?.admin?.getPlugin(this.parent)?.name || this.parent;
  }

  get children(): Plugin[] {
    const plugins: Record<string, Plugin | undefined> = this.formState?.admin?.status()?.plugins || {};
    return Object.values(plugins)
      .filter(p => !!p && directChild(p.tag, this.parent)) as Plugin[];
  }

  /**
   * Children shown in the dropdown. Hidden children are only shown when selected.
   */
  get visibleChildren(): Plugin[] {
    const current = this.current;
    return this.children.filter(p => !p.config?.hideChild || p.tag === current);
  }

  get togglePlugin(): ((tag: string) => void) | undefined {
    return this.formState?.togglePlugin;
  }

  get setPlugin(): ((tag: string, value: any) => void) | undefined {
    return this.formState?.setPlugin;
  }

  private get plugins(): AbstractControl | null | undefined {
    return this.form?.parent;
  }

  /**
   * All child plugins currently on the Ref.
   */
  get selected(): string[] {
    const tags: string[] = this.plugins?.parent?.get('tags')?.value
      || Object.keys((this.plugins as any)?.controls || {});
    return this.children.map(p => p.tag).filter(t => tags.some(tag => hasPrefix(tag, t)));
  }

  /**
   * Child plugins kept on the Ref when another child is selected.
   */
  get keep(): string[] {
    return this.props.keep || [];
  }

  /**
   * The child plugin currently selected. A kept child is only shown
   * when no other child is on the Ref.
   */
  get current(): string | undefined {
    const selected = this.selected;
    return selected.find(t => !this.keep.includes(t)) || selected[0];
  }

  select(tag: string) {
    const selected = this.selected;
    if (this.current === tag && (selected.length === 1 || tag && !this.keep.includes(tag))) return;
    const others = selected.filter(t => !this.keep.includes(t));
    // Convert from the other geometry being replaced, or a kept one when adding
    const source = others.find(t => t !== tag) || selected.find(t => t !== tag);
    const sourceValue = source && cloneDeep(this.plugins?.get(source)?.value);
    // Remove other children, keeping the selected one and kept children if a child is selected
    for (const t of selected) {
      if (t === tag) continue;
      if (tag && this.keep.includes(t)) continue;
      this.togglePlugin?.(t);
    }
    if (!tag || selected.includes(tag)) return;
    this.togglePlugin?.(tag);
    const value = this.convert(sourceValue, tag);
    if (value) this.setPlugin?.(tag, value);
  }

  /**
   * Convert the GeoJSON data of one child plugin to the type of another.
   */
  private convert(value: any, tag: string) {
    const plugin = this.children.find(p => p.tag === tag);
    return convertFeature(value, plugin?.defaults, !!(plugin?.schema as any)?.optionalProperties?.properties);
  }
}
