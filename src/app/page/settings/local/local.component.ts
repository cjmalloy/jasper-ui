import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModService } from '../../../service/mod.service';
import { Store } from '../../../store/store';

@Component({
  selector: 'app-settings-local-page',
  templateUrl: './local.component.html',
  styleUrls: ['./local.component.scss'],
  imports: [RouterLink],
  host: {
    '(window:storage)': 'refresh()',
  },
})
export class SettingsLocalPage {
  private mod = inject(ModService);
  store = inject(Store);


  constructor() {
    const mod = this.mod;

    mod.setTitle($localize`Settings: Local Storage`);
  }

  readonly refEntries = signal(this.store.local.getRefKeys());
  readonly extEntries = signal(this.store.local.getExtKeys());
  readonly helpEntries = signal(this.store.local.getHelpKeys());

  refresh() {
    this.refEntries.set(this.store.local.getRefKeys());
    this.extEntries.set(this.store.local.getExtKeys());
    this.helpEntries.set(this.store.local.getHelpKeys());
  }

  clearRefEntry(key: string) {
    this.store.local.clearRefEntry(key);
    this.refresh();
  }

  clearAllRefs() {
    if (confirm($localize`Are you sure you want to clear all Ref entries from local storage?`)) {
      this.store.local.clearAllRefs();
      this.refresh();
    }
  }

  clearExtEntry(tag: string) {
    this.store.local.clearExtEntry(tag);
    this.refresh();
  }

  clearAllExts() {
    if (confirm($localize`Are you sure you want to clear all Ext entries from local storage?`)) {
      this.store.local.clearAllExts();
      this.refresh();
    }
  }

  clearHelpEntry(key: string) {
    this.store.local.clearHelpEntry(key);
    this.refresh();
  }

  clearAllHelp() {
    if (confirm($localize`Are you sure you want to clear all help message history from local storage?`)) {
      this.store.local.clearAllHelp();
      this.refresh();
    }
  }
}
