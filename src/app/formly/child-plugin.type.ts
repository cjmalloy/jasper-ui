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
 * Has no key, so nothing is stored in the parent plugin data.
 */
@Component({
  selector: 'formly-field-child-plugin',
  host: { 'class': 'field child-plugin-field' },
  template: `
    <select class="child-plugin-select"
            [id]="id"
            [disabled]="!togglePlugin"
            (input)="select($any($event.target).value)">
      <option value="" [selected]="!current" i18n>🧰️</option>
      @for (p of children; track p.tag) {
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

  get children(): Plugin[] {
    const plugins: Record<string, Plugin | undefined> = this.formState?.admin?.status?.plugins || {};
    return Object.values(plugins)
      .filter(p => !!p && directChild(p.tag, this.parent)) as Plugin[];
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
   * The child plugin currently on the Ref.
   */
  get current(): string | undefined {
    return this.selected[0];
  }

  select(tag: string) {
    const selected = this.selected;
    if (selected.length === 1 && selected[0] === tag) return;
    const source = selected.find(t => t !== tag);
    const sourceValue = source && cloneDeep(this.plugins?.get(source)?.value);
    // Remove other children, keeping the selected one if already on the Ref
    for (const t of selected) if (t !== tag) this.togglePlugin?.(t);
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
