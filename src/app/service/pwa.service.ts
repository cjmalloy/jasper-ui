import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

import { Store } from '../store/store';

@Injectable({
  providedIn: 'root'
})
export class PwaService {

  constructor(
    private store: Store,
    private updates: SwUpdate,
  ) {
    updates.versionUpdates.subscribe(evt => {
      switch (evt.type) {
        case 'VERSION_DETECTED':
          console.log(`Downloading new app version: ${evt.version.hash}`);
          break;
        case 'VERSION_READY':
          console.log(`Current app version: ${evt.currentVersion.hash}`);
          console.log(`New app version ready for use: ${evt.latestVersion.hash}`);
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.error(`Failed to install app version '${evt.version.hash}': ${evt.error}`);
          break;
      }
    });
    updates.unrecoverable.subscribe(event => {
      console.error(`Unrecoverable PWA error: ${event.reason}`);
      (store.account.unrecoverable = true);
    });
  }
}
