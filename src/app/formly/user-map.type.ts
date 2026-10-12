import { ChangeDetectionStrategy, Component, DoCheck } from '@angular/core';
import { FieldArrayType, FormlyField } from '@ngx-formly/core';
import { defer } from 'lodash-es';
import { Store } from '../store/store';
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
          <span class="user-map-origin user-map-local-origin" [title]="localOrigin || '@'">{{ localOrigin || '@' }}</span>
          <span class="user-map-arrow"></span>
          <span class="user-map-origin user-map-remote-origin" [title]="remoteOrigin || '@'">{{ remoteOrigin || '@' }}</span>
          <span class="user-map-spacer"></span>
        </div>
      }
      @for (row of field.fieldGroup; track row.id; let i = $index) {
        <div class="user-map-row">
          <div class="user-map-local">
            <formly-field [field]="row.fieldGroup![0]"></formly-field>
          </div>
          <span class="user-map-arrow"></span>
          <div class="user-map-remote">
            <formly-field [field]="row.fieldGroup![1]"></formly-field>
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
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    FormlyField,
  ],
})
export class FormlyFieldUserMap extends FieldArrayType implements DoCheck {

  constructor(
    private store: Store,
  ) {
    super();
  }

  get localOrigin() {
    return this.store.account.origin || '';
  }

  /**
   * Origin the remote users are pulled into, from the local alias of the
   * origin being edited.
   */
  get remoteOrigin() {
    return subOrigin(this.localOrigin, this.field.parent?.model?.local);
  }

  /**
   * Preview remote users in the remote origin, and refresh the previews
   * when the remote origin changes.
   */
  ngDoCheck() {
    const origin = this.remoteOrigin;
    for (const row of this.field.fieldGroup || []) {
      const user = row.fieldGroup?.find(f => f.key === 'remote');
      if (!user?.props || user.props.origin === origin) continue;
      const changed = user.props.origin !== undefined;
      user.props.origin = origin;
      if (changed) defer(() => user.formControl?.updateValueAndValidity());
    }
  }
}
