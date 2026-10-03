import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FieldArrayType, FormlyField, FormlyFieldConfig } from '@ngx-formly/core';
import { cloneDeep } from 'lodash-es';
import { Plugin } from '../model/plugin';
import { directChild } from '../util/tag';

/**
 * List of features in a GeoJSON FeatureCollection. Each child plugin of
 * props.parent with a single geometry type can be added to the list, and is
 * edited with the coordinates form of that plugin. Each feature has its own
 * style.
 */
@Component({
  selector: 'formly-field-geometries',
  host: { 'class': 'field geometries-field' },
  template: `
    <label>{{ props.label || '' }}</label>
    <div class="form-group">
      <select class="geometry-add"
              [title]="props.addText || ''"
              [attr.aria-label]="props.addText || ''"
              [disabled]="formControl.disabled"
              (input)="addGeometry($any($event.target))">
        <option value="" selected>{{ props.addText || '' }}</option>
        @for (p of geometryPlugins; track p.tag) {
          <option [value]="p.tag">{{ p.name || '#' + p.tag }}</option>
        }
      </select>
      @for (f of field.fieldGroup; track f.id; let i = $index) {
        <div class="form-array geometry-item">
          <span class="geometry-name">{{ name(geometryType(model?.[i])) }}</span>
          <formly-field class="grow" [field]="f"></formly-field>
          <button type="button" (click)="remove(i)" i18n>&ndash;</button>
        </div>
      }
    </div>
  `,
  styles: `
    .geometry-item {
      flex-wrap: wrap;
    }
    .geometry-name {
      flex-basis: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormlyField],
})
export class FormlyFieldGeometries extends FieldArrayType {

  /**
   * Build each geometry with the form of its plugin. Set here since
   * functions are not stored in plugin configs.
   */
  prePopulate(field: FormlyFieldConfig) {
    field.fieldArray = (f: FormlyFieldConfig) => {
      // Called once for each new item, in order
      const index = f.fieldGroup?.length || 0;
      const type = geometryType((Array.isArray(f.model) ? f.model : [])[index]);
      const field = geometryField(geometryPlugins(f).find(p => p.defaults?.geometry?.type === type));
      return {
        fieldGroup: [
          { key: 'type', defaultValue: 'Feature' },
          { key: 'properties', type: 'geo-style', props: { fill: type === 'Polygon' || type === 'MultiPolygon' } },
          { ...field, key: 'geometry' },
        ],
      };
    };
  }

  get geometryPlugins() {
    return geometryPlugins(this.field);
  }

  geometryType(item: any) {
    return geometryType(item);
  }

  name(type?: string) {
    const plugin = this.geometryPlugins.find(p => p.defaults?.geometry?.type === type);
    return plugin?.name || type || '';
  }

  addGeometry(select: HTMLSelectElement) {
    const plugin = this.geometryPlugins.find(p => p.tag === select.value);
    select.value = '';
    if (!plugin) return;
    const geometry = cloneDeep(plugin.defaults!.geometry);
    this.add(undefined, { type: 'Feature', geometry });
  }
}

function geometryType(item: any): string | undefined {
  return item?.geometry?.type;
}

/**
 * Child plugins of props.parent storing a single geometry.
 */
function geometryPlugins(field: FormlyFieldConfig): Plugin[] {
  const parent = field.props?.parent;
  const plugins: Record<string, Plugin | undefined> = field.options?.formState?.admin?.status?.plugins || {};
  return (Object.values(plugins) as Plugin[])
    .filter(p => !!p && directChild(p.tag, parent))
    .filter(p => p.defaults?.geometry?.type && geometryCoordinates(p));
}

function geometryCoordinates(plugin?: Plugin): FormlyFieldConfig | undefined {
  return plugin?.config?.form?.find((f: FormlyFieldConfig) => f.key === 'geometry.coordinates');
}

function geometryField(plugin?: Plugin): FormlyFieldConfig {
  const coordinates = geometryCoordinates(plugin);
  return {
    fieldGroup: [
      { key: 'type' },
      ...coordinates ? [{ ...cloneDeep(coordinates), key: 'coordinates' }] : [],
    ],
  };
}
