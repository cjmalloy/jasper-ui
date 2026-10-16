import { Component, computed, effect, inject, untracked } from '@angular/core';
import { FieldArrayType, FormlyField } from '@ngx-formly/core';
import { Store } from '../store/store';
import { controlValue } from '../util/form';
import { subOrigin } from '../util/tag';

/**
 * Table of user mappings. Each row maps a local user to a user in the
 * remote origin. Repeat a user in multiple rows to map it to multiple users.
 */
@Component({
  selector: 'formly-field-user-map',
  host: { 'class': 'field user-map-field' },
  template: `
    <label>{{ props.label }}</label>
    <div class="form-group user-map">
      <button type="button" class="user-map-add" (click)="add()">{{ props.addText }}</button>
      @if (field.fieldGroup?.length) {
        <div class="user-map-header">
          <span class="user-map-origin user-map-local-origin" [title]="localOrigin() || '@'">{{ localOrigin() || '@' }}</span>
          <span class="user-map-arrow"></span>
          <span class="user-map-origin user-map-remote-origin" [title]="remoteOrigin() || '@'">{{ remoteOrigin() || '@' }}</span>
          <span class="user-map-spacer"></span>
        </div>
      }
      @for (row of field.fieldGroup; track row.id; let i = $index) {
        <div class="user-map-row">
          <div class="user-map-local">
            <formly-field [field]="row.fieldGroup![0]" />
          </div>
          <span class="user-map-arrow"></span>
          <div class="user-map-remote">
            <formly-field [field]="row.fieldGroup![1]" />
          </div>
          <button type="button" class="user-map-remove" (click)="remove(i)" i18n>&ndash;</button>
        </div>
      }
    </div>
  `,
  styles: `
    .user-map-header, .user-map-row {
      display: flex;
      align-items: flex-start;
      gap: 4px;
    }
    .user-map-row {
      padding-top: 4px;
      border-top: 0.5px dashed var(--border);
    }
    .user-map-local, .user-map-remote, .user-map-origin {
      flex: 1;
      min-width: 0;
    }
    .user-map-origin {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: bold;
    }
    .user-map-arrow {
      width: 16px;
      line-height: 24px;
      text-align: center;
    }
    .user-map-arrow::after {
      content: '→';
    }
    .user-map-header .user-map-arrow {
      line-height: unset;
    }
    .user-map-spacer, .user-map-remove {
      width: 32px;
      min-width: 32px;
    }
  `,
  imports: [
    FormlyField,
  ],
})
export class FormlyFieldUserMap extends FieldArrayType {
  private store = inject(Store);

  readonly localOrigin = computed(() => this.store.account.origin() || '');

  /**
   * Local alias of the origin being edited.
   */
  private readonly localAlias = controlValue<string>(() => this.field.parent?.formControl?.get('local'));

  /**
   * Rows of the user map, to update previews when rows are added or removed.
   */
  private readonly rows = controlValue(() => this.formControl);

  /**
   * Origin the remote users are pulled into, from the local alias of the
   * origin being edited.
   */
  readonly remoteOrigin = computed(() => subOrigin(this.localOrigin(), this.localAlias()));

  constructor() {
    super();
    // Syncs the remote origin into the remote user previews
    effect(() => {
      const origin = this.remoteOrigin();
      this.rows();
      untracked(() => {
        for (const row of this.field.fieldGroup || []) {
          const user = row.fieldGroup?.find(f => f.key === 'remote');
          if (!user?.props || user.props.origin === origin) continue;
          const changed = user.props.origin !== undefined;
          user.props.origin = origin;
          if (changed) user.formControl?.updateValueAndValidity();
        }
      });
    });
  }
}
