import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { FieldType } from '@ngx-formly/core';
import { Plugin } from '../model/plugin';
import { directChild, hasPrefix } from '../util/tag';

/**
 * Select a single child plugin of the parent plugin (props.parent).
 * Changing the selection swaps the child plugin tag on the Ref.
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

  /**
   * The child plugin currently on the Ref.
   */
  get current(): string | undefined {
    const plugins: AbstractControl | null | undefined = this.form?.parent;
    const tags: string[] = plugins?.parent?.get('tags')?.value
      || Object.keys((plugins as any)?.controls || {});
    return this.children.map(p => p.tag).find(t => tags.some(tag => hasPrefix(tag, t)));
  }

  select(tag: string) {
    const current = this.current;
    if (tag === current) return;
    if (current) this.togglePlugin?.(current);
    if (tag) this.togglePlugin?.(tag);
  }
}
