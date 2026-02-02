import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings-local-page',
  templateUrl: './local.component.html',
  styleUrls: ['./local.component.scss'],
  imports: [RouterLink],
})
export class SettingsLocalPage {

  constructor(
    private mod: ModService,
    public store: Store,
  ) {
    mod.setTitle($localize`Settings: Local Storage`);
  }

  get refEntries() {
    return this.store.local.getRefKeys();
  }

  get extEntries() {
    return this.store.local.getExtKeys();
  }

  clearRefEntry(key: string) {
    this.store.local.clearRefEntry(key);
  }

  clearAllRefs() {
    if (confirm($localize`Are you sure you want to clear all Ref entries from local storage?`)) {
      this.store.local.clearAllRefs();
    }
  }

  clearExtEntry(tag: string) {
    this.store.local.clearExtEntry(tag);
  }

  clearAllExts() {
    if (confirm($localize`Are you sure you want to clear all Ext entries from local storage?`)) {
      this.store.local.clearAllExts();
    }
  }
}
